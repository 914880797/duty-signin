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
        
        for (const item of config) {
            if (!item.duty_date || !item.duty_time || !item.name) {
                return Response.json({ error: '排班数据不完整' }, { status: 400 });
            }
        }
        
        const batch = [];
        for (const item of config) {
            batch.push(
                env.DB.prepare(`
                    INSERT OR REPLACE INTO duty_config (duty_date, duty_time, name, group_id)
                    VALUES (?, ?, ?, ?)
                `).bind(item.duty_date, item.duty_time, item.name, item.group_id || null)
            );
        }
        await env.DB.batch(batch);
        
        return Response.json({ 
            success: true,
            message: '排班成功'
        });
    } catch (error) {
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
