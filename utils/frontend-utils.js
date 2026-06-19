(function() {
  'use strict';
  if (window.AppUtils) return;

  const DEFAULT_SHIFTS = [
    '04:00-06:00', '06:00-08:00', '08:00-09:30', '09:30-11:00',
    '11:00-12:30', '12:30-14:00', '14:00-15:30', '15:30-17:00',
    '17:00-18:30', '18:30-20:00', '20:00-21:30', '21:30-23:00',
    '23:00-24:00', '24:00-04:00'
  ];

  window.AppUtils = {
    DEFAULT_SHIFTS: DEFAULT_SHIFTS,

    apiFetch: async function(path, options = {}) {
      const res = await fetch(path, options);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '请求失败');
      return data;
    },

    loadShifts: async function(selectElement, selectAllLabel) {
      if (!selectAllLabel) selectAllLabel = '-- 全部时段 --';
      try {
        const settings = await this.apiFetch('/api/settings');
        const validDutyTimes = settings.validDutyTimes || [];
        if (validDutyTimes.length > 0) {
          var options = validDutyTimes.map(function(t) {
            return '<option value="' + t + '">' + t + '</option>';
          }).join('');
          selectElement.innerHTML = '<option value="">' + selectAllLabel + '</option>' + options;
          return;
        }
      } catch (e) {
        console.error('加载有效时段失败:', e);
      }
      var options = DEFAULT_SHIFTS.map(function(t) {
        return '<option value="' + t + '">' + t + '</option>';
      }).join('');
      selectElement.innerHTML = '<option value="">' + selectAllLabel + '</option>' + options;
    },

    loadGroups: async function(selectElement, selectAllLabel) {
      if (!selectAllLabel) selectAllLabel = '-- 全部分组 --';
      try {
        const data = await this.apiFetch('/api/groups');
        var groups = data.data || [];
        var options = groups.map(function(g) {
          return '<option value="' + g.id + '">' + g.name + '</option>';
        }).join('');
        selectElement.innerHTML = '<option value="">' + selectAllLabel + '</option>' + options;
        return groups;
      } catch (e) {
        console.error('加载分组失败:', e);
        selectElement.innerHTML = '<option value="">' + selectAllLabel + '</option>';
        return [];
      }
    }
  };
})();
