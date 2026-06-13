export async function onRequestPost(context) {
    const { request, env } = context;
    
    try {
        const data = await request.json();
        const { date, config, repeatDays } = data;
        
        if (!date) {
            return Response.json({ error: '缺少日期参数' }, { status: 400 });
        }
        
        if (!config || !Array.isArray(config)) {
            return Response.json({ error: '排班数据格式错误' }, { status: 400 });
        }
        
        // 默认循环 365 天（一年），如果 repeatDays 为 0 则只排当天
        const daysToRepeat = repeatDays !== undefined ? repeatDays : 365;
        
        for (const item of config) {
            if (!item.duty_date || !item.duty_time || !item.name) {
                return Response.json({ error: '排班数据不完整' }, { status: 400 });
            }
        }
        
        const batch = [];
        for (const item of config) {
            // 循环添加 N 天的排班
            for (let i = 0; i < daysToRepeat; i++) {
                const targetDate = new Date(item.duty_date);
                targetDate.setUTCDate(targetDate.getUTCDate() + i);
                const pad = (n) => String(n).padStart(2, '0');
                const dateStr = `${targetDate.getUTCFullYear()}-${pad(targetDate.getUTCMonth() + 1)}-${pad(targetDate.getUTCDate())}`;
                
                batch.push(
                    env.DB.prepare(`
                        INSERT OR REPLACE INTO duty_config (duty_date, duty_time, name, group_id)
                        VALUES (?, ?, ?, ?)
                    `).bind(dateStr, item.duty_time, item.name, item.group_id || null)
                );
            }
        }
        
        // 分批执行，每批 100 条
        const batchSize = 100;
        for (let i = 0; i < batch.length; i += batchSize) {
            await env.DB.batch(batch.slice(i, i + batchSize));
        }
        
        return Response.json({ 
            success: true,
            message: `排班成功！已排版 ${daysToRepeat} 天`,
            days: daysToRepeat
        });
    } catch (error) {
        console.error('排班失败:', error);
        return Response.json({ error: '服务器错误' }, { status: 500 });
    }
}

export async function onRequestGet(context) {
    const { request, env } = context;
    
    try {
        const url = new URL(request.url);
        const date = url.searchParams.get('date');
        
        if (!date) {
            return Response.json({ error: '缺少日期参数' }, { status: 400 });
        }
        
        const { results } = await env.DB.prepare(`
            SELECT dc.duty_time, dc.name, dc.group_id, sg.name as group_name
            FROM duty_config dc
            LEFT JOIN shift_groups sg ON dc.group_id = sg.id
            WHERE dc.duty_date = ?
            ORDER BY dc.duty_time, sg.order_index, sg.name
        `).bind(date).all();
        
        return Response.json({ 
            success: true,
            data: results || []
        });
    } catch (error) {
        return Response.json({ error: '服务器错误' }, { status: 500 });
    }
}

export async function onRequestDelete(context) {
    const { request, env } = context;
    
    try {
        const data = await request.json();
        const { date, duty_time, name } = data;
        
        if (!date) {
            return Response.json({ error: '缺少日期参数' }, { status: 400 });
        }
        
        if (duty_time && name) {
            await env.DB.prepare(`
                DELETE FROM duty_config
                WHERE duty_date = ? AND duty_time = ? AND name = ?
            `).bind(date, duty_time, name).run();
        } 
        else if (data.names && Array.isArray(data.names) && data.names.length > 0) {
            const placeholders = data.names.map(() => '?').join(',');
            await env.DB.prepare(`
                DELETE FROM duty_config
                WHERE duty_date = ? AND name IN (${placeholders})
            `).bind(date, ...data.names).run();
        } 
        else {
            return Response.json({ error: '缺少删除参数' }, { status: 400 });
        }
        
        return Response.json({ 
            success: true,
            message: '删除成功'
        });
    } catch (error) {
        return Response.json({ error: '服务器错误' }, { status: 500 });
    }
}
