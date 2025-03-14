/**
 * 存储工具模块
 * 提供与存储相关的工具函数
 */
module.exports = {
    // 查找存储设施
    findStorage: function(room) {
        return room.storage || 
               room.terminal || 
               room.find(FIND_STRUCTURES, {
                   filter: s => {
                       if (s.structureType !== STRUCTURE_CONTAINER) return false;
                       
                       // 安全地检查容量
                       try {
                           if (typeof s.store.getFreeCapacity === 'function') {
                               return s.store.getFreeCapacity() > 0;
                           } else {
                               // 旧版API兼容
                               return s.storeCapacity - _.sum(s.store) > 0;
                           }
                       } catch (e) {
                           return false;
                       }
                   }
               })[0];
    }
}; 