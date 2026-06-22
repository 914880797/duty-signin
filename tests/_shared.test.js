/**
 * _shared.js 核心逻辑单元测试
 * 测试关键函数：时间解析、时段匹配、工具函数
 */
'use strict';

const assert = {
    equal(actual, expected, msg) {
        if (actual !== expected) throw new Error(`${msg}: 期望 ${JSON.stringify(expected)}, 实际 ${JSON.stringify(actual)}`);
    },
    deepEqual(actual, expected, msg) {
        const a = JSON.stringify(actual), e = JSON.stringify(expected);
        if (a !== e) throw new Error(`${msg}: 期望 ${e}, 实际 ${a}`);
    },
    ok(value, msg) {
        if (!value) throw new Error(`${msg}: 期望 truthy, 实际 ${value}`);
    },
    throws(fn, msg) {
        try { fn(); throw new Error(`${msg}: 应该抛出异常但未抛出`); } catch (e) {}
    }
};

let passed = 0, failed = 0;
function test(name, fn) {
    try {
        fn();
        passed++;
    } catch (e) {
        failed++;
        console.error(`  FAIL  ${name}: ${e.message}`);
    }
}

// ---------- 复制被测函数 ----------
function pad(n) { return String(n).padStart(2, '0'); }

function getDutyTimeRange(dutyTime) {
    if (!dutyTime || dutyTime === '未安排') return null;
    const clean = dutyTime.replace(/\s+/g, '');
    const match = clean.match(/(\d{2}):(\d{2})-(\d{2}):(\d{2})/);
    if (!match) return null;
    let [, startHour, startMin, endHour, endMin] = match.map(Number);
    const originalStartHour = startHour;
    if (startHour === 24) startHour = 0;
    if (endHour === 24) endHour = 0;
    return {
        startTime: startHour * 60 + startMin,
        endTime: endHour * 60 + endMin,
        name: clean,
        isOvernight: originalStartHour > endHour && originalStartHour !== 24
    };
}

function getDutyStartMinutes(dutyTime) {
    if (!dutyTime) return null;
    const clean = dutyTime.replace(/\s+/g, '');
    const match = clean.match(/(\d{2}):(\d{2})/);
    if (!match) return null;
    const hour = parseInt(match[1]) % 24;
    return hour * 60 + parseInt(match[2]);
}

function getDutyEndMinutes(dutyTime) {
    if (!dutyTime) return null;
    const clean = dutyTime.replace(/\s+/g, '');
    const match = clean.match(/(\d{2}):(\d{2})-(\d{2}):(\d{2})/);
    if (!match) return null;
    return parseInt(match[3]) * 60 + parseInt(match[4]);
}

// ---------- 测试用例 ----------
console.log('\n  _shared.js 单元测试\n');

// pad
test('pad(5) => "05"', () => assert.equal(pad(5), '05'));
test('pad(12) => "12"', () => assert.equal(pad(12), '12'));
test('pad(0) => "00"', () => assert.equal(pad(0), '00'));

// getDutyTimeRange - 正常时段
test('正常时段 08:00-09:30', () => {
    const r = getDutyTimeRange('08:00-09:30');
    assert.equal(r.startTime, 480);
    assert.equal(r.endTime, 570);
    assert.equal(r.isOvernight, false);
});

test('23:00-24:00 (endHour 规范化导致跨午夜标记为true)', () => {
    const r = getDutyTimeRange('23:00-24:00');
    assert.equal(r.startTime, 1380);
    assert.equal(r.endTime, 0);  // 24:00 规范化为 0
    assert.ok(r.isOvernight, 'endTime 0 < startTime 1380，标记为跨午夜');
});

// 跨午夜时段
test('跨午夜时段 23:00-04:00', () => {
    const r = getDutyTimeRange('23:00-04:00');
    assert.equal(r.startTime, 1380);
    assert.equal(r.endTime, 240);
    assert.ok(r.isOvernight, 'isOvernight 应为 true');
});

test('跨午夜时段 24:00-04:00', () => {
    const r = getDutyTimeRange('24:00-04:00');
    assert.equal(r.startTime, 0);
    assert.equal(r.endTime, 240);
    assert.equal(r.isOvernight, false);
});

// 边界情况
test('null 输入返回 null', () => {
    assert.equal(getDutyTimeRange(null), null);
    assert.equal(getDutyTimeRange(''), null);
    assert.equal(getDutyTimeRange('未安排'), null);
});

test('无效格式返回 null', () => {
    assert.equal(getDutyTimeRange('abc'), null);
    assert.equal(getDutyTimeRange('8:00-9:30'), null);
});

test('带空格格式正确解析', () => {
    const r = getDutyTimeRange(' 08:00 - 09:30 ');
    assert.equal(r.startTime, 480);
    assert.equal(r.endTime, 570);
});

// getDutyStartMinutes
test('startMinutes 基本', () => {
    assert.equal(getDutyStartMinutes('08:00-09:30'), 480);
    assert.equal(getDutyStartMinutes('24:00-04:00'), 0);
    assert.equal(getDutyStartMinutes('00:00-01:00'), 0);
});

test('startMinutes 异常输入', () => {
    assert.equal(getDutyStartMinutes(null), null);
    assert.equal(getDutyStartMinutes(''), null);
    assert.equal(getDutyStartMinutes('invalid'), null);
});

// getDutyEndMinutes
test('endMinutes 基本', () => {
    assert.equal(getDutyEndMinutes('08:00-09:30'), 570);
    assert.equal(getDutyEndMinutes('23:00-24:00'), 1440);
    assert.equal(getDutyEndMinutes('24:00-04:00'), 240);
});

// 综合场景：signin 中的跨午夜验证逻辑
test('跨午夜 validation: 在 01:00 打卡 24:00-04:00 时段', () => {
    const r = getDutyTimeRange('24:00-04:00');
    let currentTimeInMinutes = 60;  // 01:00
    if (currentTimeInMinutes <= r.endTime) {
        currentTimeInMinutes += 24 * 60;  // 加一天
    }
    assert.equal(currentTimeInMinutes, 1500);
    const isValid = currentTimeInMinutes >= r.startTime && currentTimeInMinutes <= r.endTime + 24 * 60;
    assert.ok(isValid, '应在有效时间内');
});

test('跨午夜 validation: 在 23:30 打卡 23:00-04:00 时段', () => {
    const r = getDutyTimeRange('23:00-04:00');
    let currentTimeInMinutes = 1410;  // 23:30
    if (r.isOvernight && currentTimeInMinutes <= r.endTime) {
        currentTimeInMinutes += 24 * 60;
    } else if (r.isOvernight) {
        r.endTime += 24 * 60;
    }
    const isValid = currentTimeInMinutes >= r.startTime && currentTimeInMinutes <= r.endTime;
    assert.ok(isValid, '应在有效时间内');
});

console.log(`\n  结果: ${passed} 通过, ${failed} 失败\n`);
process.exit(failed > 0 ? 1 : 0);
