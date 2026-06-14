(function() {
    'use strict';
    if (window.DateUtils) return;

    var TZ_OFFSET = 8 * 60 * 60 * 1000;

    function pad(n) { return (n < 10 ? '0' : '') + String(n); }

    window.DateUtils = {

        getBeijingNow: function() {
            return new Date(Date.now() + TZ_OFFSET);
        },

        getBeijingDate: function(date) {
            date = date || new Date();
            return date instanceof Date ? new Date(date.getTime() + TZ_OFFSET) : null;
        },

        formatBeijingDate: function(date) {
            if (!date) date = new Date();
            var bj = this.getBeijingDate(date);
            if (!bj) return '';
            return bj.getUTCFullYear() + '-' + pad(bj.getUTCMonth() + 1) + '-' + pad(bj.getUTCDate());
        },

        formatBeijingTime: function(date) {
            if (!date) date = new Date();
            var bj = this.getBeijingDate(date);
            if (!bj) return '';
            return this.formatBeijingDate(bj) + ' ' + pad(bj.getUTCHours()) + ':' + pad(bj.getUTCMinutes());
        },

        pad: pad,

        todayBeijing: function() {
            return this.formatBeijingDate();
        },

        daysAgoBeijing: function(days) {
            var bj = this.getBeijingNow();
            bj.setTime(bj.getTime() - days * 24 * 60 * 60 * 1000);
            return bj.getUTCFullYear() + '-' + pad(bj.getUTCMonth() + 1) + '-' + pad(bj.getUTCDate());
        },

        getNaturalDate: function(createdAt, dutyTime) {
            if (!createdAt) return null;
            var date = new Date(createdAt);
            var bj = this.getBeijingDate(date);
            var bjHour = bj.getUTCHours();
            var displayDate = bj.getUTCFullYear() + '-' + pad(bj.getUTCMonth() + 1) + '-' + pad(bj.getUTCDate());
            if (bjHour < 8) {
                bj.setUTCDate(bj.getUTCDate() - 1);
                displayDate = bj.getUTCFullYear() + '-' + pad(bj.getUTCMonth() + 1) + '-' + pad(bj.getUTCDate());
            }
            return displayDate;
        }
    };
})();
