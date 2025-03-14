 /**
 * 内存优化工具模块
 * 提供内存清理、压缩和优化功能
 */
 module.exports = {
    // 清理内存
    cleanMemory: function() {
        // 清理死亡creep的内存
        for(let name in Memory.creeps) {
            if(!Game.creeps[name]) {
                delete Memory.creeps[name];
            }
        }
        
        // 清理不存在的房间记忆
        for(let roomName in Memory.rooms) {
            if(!Game.rooms[roomName] || !Game.rooms[roomName].controller || !Game.rooms[roomName].controller.my) {
                // 保留探索数据，但清理其他数据
                const exploration = Memory.rooms[roomName].exploration;
                Memory.rooms[roomName] = { exploration: exploration || {} };
            }
        }
        
        // 清理过期的标记
        if(Memory.flags) {
            for(let flagName in Memory.flags) {
                if(!Game.flags[flagName]) {
                    delete Memory.flags[flagName];
                }
            }
        }
    },
    
    // 深度清理内存
    deepCleanMemory: function() {
        // 清理过期的监控数据
        for(let roomName in Memory.rooms) {
            if(Memory.rooms[roomName].monitor) {
                // 清理超过7天的异常记录
                if(Memory.rooms[roomName].monitor.anomalies) {
                    Memory.rooms[roomName].monitor.anomalies = Memory.rooms[roomName].monitor.anomalies.filter(
                        a => Game.time - a.time < 20000
                    );
                }
            }
            
            // 清理过期的资源清理目标
            if(Memory.rooms[roomName].resourceCleaner) {
                const targets = Memory.rooms[roomName].resourceCleaner.targets;
                const collectors = Memory.rooms[roomName].resourceCleaner.collectors;
                
                // 清理超过1小时未更新的目标
                for(let targetId in targets) {
                    if(!Game.getObjectById(targetId)) {
                        delete targets[targetId];
                        if(collectors[targetId]) {
                            delete collectors[targetId];
                        }
                    }
                }
            }
        }
    },
    
    // 获取内存使用情况
    getMemoryUsage: function() {
        const memorySize = RawMemory.get().length;
        return {
            bytes: memorySize,
            kilobytes: memorySize / 1024,
            megabytes: memorySize / 1024 / 1024,
            percentage: memorySize / 2097152 * 100
        };
    },
    
    // 压缩对象
    compressObject: function(obj) {
        // 移除undefined和null值
        if(typeof obj !== 'object' || obj === null) return obj;
        
        const result = Array.isArray(obj) ? [] : {};
        
        for(const key in obj) {
            const value = obj[key];
            
            // 跳过undefined和null值
            if(value === undefined || value === null) continue;
            
            // 递归压缩对象
            if(typeof value === 'object') {
                const compressed = this.compressObject(value);
                if(Object.keys(compressed).length > 0) {
                    result[key] = compressed;
                }
            } else {
                result[key] = value;
            }
        }
        
        return result;
    },
    
    // 压缩内存
    compressMemory: function() {
        // 压缩房间内存
        for(let roomName in Memory.rooms) {
            Memory.rooms[roomName] = this.compressObject(Memory.rooms[roomName]);
        }
        
        // 压缩creep内存
        for(let name in Memory.creeps) {
            Memory.creeps[name] = this.compressObject(Memory.creeps[name]);
        }
    },
    
    // 运行内存优化
    run: function() {
        // 每20个tick清理一次内存
        if(Game.time % 20 === 0) {
            this.cleanMemory();
        }
        
        // 每1000个tick进行一次深度清理和压缩
        if(Game.time % 1000 === 0) {
            this.deepCleanMemory();
            this.compressMemory();
            
            // 输出内存使用情况
            const usage = this.getMemoryUsage();
            console.log(`内存使用: ${usage.megabytes.toFixed(2)}MB / 2MB (${usage.percentage.toFixed(2)}%)`);
        }
    }
};