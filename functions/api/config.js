export async function onRequestPost(context) {
    const { request, env } = context;
    
    try {
        const data = await request.json();
        const { date, config } = data;
        
        if (!date) {
            return Response.json({ error: '缺少日期参数' }, { status: 400 });
        }
        
        if (!config || !Array.isArray(config)) {
            return Response.json({ error: '排班数据格式错误' }, { status: 400 });
        }
        
        // 验证每个排班数据
        for (const item of config) {
            if (!item.duty_date || !item.duty_time || !item.name) {
                return Response.json({ error: '排班数据不完整' }, { status: 400 });
            }
        }
        
        // 批量插入或更新排班
        const batch = [];
        for (const item of config) {
            batch.push(
                env.DB.prepare(`
                    INSERT OR REPLACE INTO duty_config (duty_date, duty_time, name)
                    VALUES (?, ?, ?)
                `).bind(item.duty_date, item.duty_time, item.name)
            );
        }
        await env.DB.batch(batch);
        
        return Response.json({ 
            success: true,
            message: '排班成功'
        });
    } catch (error) {
        console.error('保存排班失败:', error);
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
            SELECT duty_time, name FROM duty_config
            WHERE duty_date = ?
            ORDER BY duty_time
        `).bind(date).all();
        
        return Response.json({ 
            success: true,
            data: results || []
        });
    } catch (error) {
        console.error('获取排班失败:', error);
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
        
        // 如果提供了 duty_time 和 name，精确删除该条记录
        if (duty_time && name) {
            await env.DB.prepare(`
                DELETE FROM duty_config
                WHERE duty_date = ? AND duty_time = ? AND name = ?
            `).bind(date, duty_time, name).run();
        } 
        // 否则按 names 数组批量删除
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
        console.error('删除排班失败:', error);
        return Response.json({ error: '服务器错误' }, { status: 500 });
    }
}
