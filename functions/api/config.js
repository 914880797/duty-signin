import { jsonSuccess, jsonError, verifyAdmin } from './_shared.js';

export async function onRequestPost(context) {
    const { request, env } = context;
    const isAdmin = await verifyAdmin(request, env);
    if (!isAdmin) return jsonError('未授权访问', 401);
    
    try {
        const data = await request.json();
        const { date, config } = data;
        
        if (!date) return jsonError('缺少日期参数', 400);
        if (!config || !Array.isArray(config)) return jsonError('排班数据格式错误', 400);
        
        for (const item of config) {
            if (!item.duty_date || !item.duty_time || !item.name) {
                return jsonError('排班数据不完整', 400);
            }
        }
        
        const batch = [];
        for (const item of config) {
            batch.push(
                env.DB.prepare(`
                    INSERT INTO duty_config (duty_date, duty_time, name, group_id)
                    VALUES (?, ?, ?, ?)
                `).bind(item.duty_date, item.duty_time, item.name, item.group_id || null)
            );
        }
        await env.DB.batch(batch);
        
        return jsonSuccess({ message: '排班成功' });
    } catch (error) {
        console.error('排班失败:', error);
        return jsonError('服务器错误');
    }
}

export async function onRequestGet(context) {
    const { request, env } = context;
    
    try {
        const url = new URL(request.url);
        const date = url.searchParams.get('date');
        const duty_time = url.searchParams.get('duty_time');
        const group_id = url.searchParams.get('group_id');
        
        if (!date) return jsonError('缺少日期参数', 400);

        // 获取有效的时段列表
        const validTimesSetting = await env.DB.prepare(`
          SELECT value FROM settings WHERE key = 'valid_duty_times'
        `).first();
        const validDutyTimes = validTimesSetting?.value ? JSON.parse(validTimesSetting.value) : null;
        
        let bindingWhere = '1=1';
        const bindingExtraArgs = [];
        if (validDutyTimes && validDutyTimes.length > 0) {
            bindingWhere = 'b.duty_time IN (' + validDutyTimes.map(() => '?').join(',') + ')';
            bindingExtraArgs.push(...validDutyTimes);
        }
        
        let sql = `
            SELECT duty_time, name, group_id, group_name FROM (
                -- 当天的排班（临时）
                SELECT dc.duty_time, dc.name, dc.group_id, sg.name as group_name
                FROM duty_config dc
                LEFT JOIN shift_groups sg ON dc.group_id = sg.id
                WHERE dc.duty_date = ?
                ${duty_time ? 'AND dc.duty_time = ?' : ''}
                ${group_id ? 'AND dc.group_id = ?' : ''}
                
                UNION
                
                -- 永久绑定（仅限有效时段）
                SELECT b.duty_time, b.name, b.group_id, sg.name as group_name
                FROM duty_bindings b
                LEFT JOIN shift_groups sg ON b.group_id = sg.id
                WHERE ${bindingWhere}
                ${duty_time ? 'AND b.duty_time = ?' : ''}
                ${group_id ? 'AND b.group_id = ?' : ''}
            )
            ORDER BY duty_time, group_name, name
        `;
        
        const bindings = [date];
        if (duty_time) bindings.push(duty_time);
        if (group_id) bindings.push(parseInt(group_id));
        bindings.push(...bindingExtraArgs);
        if (duty_time) bindings.push(duty_time);
        if (group_id) bindings.push(parseInt(group_id));
        
        const { results } = await env.DB.prepare(sql).bind(...bindings).all();
        
        return jsonSuccess({ data: results || [] });
    } catch (error) {
        return jsonError('服务器错误');
    }
}

export async function onRequestDelete(context) {
    const { request, env } = context;
    const isAdmin = await verifyAdmin(request, env);
    if (!isAdmin) return jsonError('未授权访问', 401);
    try {
        const { date, duty_time, name, names } = await request.json();
        
        if (!date) return jsonError('缺少日期参数', 400);
        
        if (names && Array.isArray(names) && names.length > 0) {
            const placeholders = names.map(() => '?').join(',');
            const result = await env.DB.prepare(`
                DELETE FROM duty_config WHERE duty_date = ? AND name IN (${placeholders})
            `).bind(date, ...names).run();
            
            return jsonSuccess({ deleted: result.meta?.changes || 0 });
        }
        
        if (duty_time && name) {
            await env.DB.prepare(`
                DELETE FROM duty_config WHERE duty_date = ? AND duty_time = ? AND name = ?
            `).bind(date, duty_time, name).run();
            
            return jsonSuccess();
        }
        
        return jsonError('缺少参数', 400);
    } catch (error) {
        console.error('删除排班失败:', error);
        return jsonError('服务器错误');
    }
}
