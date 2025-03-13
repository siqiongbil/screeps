module.exports = {
    // 获取房间能量状态
    getRoomEnergyStatus: function(room) {
        const structures = room.find(FIND_STRUCTURES, {
            filter: (structure) => {
                return (structure.structureType == STRUCTURE_EXTENSION ||
                        structure.structureType == STRUCTURE_SPAWN) &&
                        structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
            }
        });
        return {
            needEnergy: structures.length > 0,
            structures: structures
        };
    },

    // 计算最佳creep体型
    calculateCreepBody: function(energy) {
        if (energy >= 550) {
            return [WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE];
        } else if (energy >= 400) {
            return [WORK, WORK, CARRY, CARRY, MOVE, MOVE];
        } else {
            return [WORK, CARRY, MOVE];
        }
    },

    // 获取房间状态
    getRoomStatus: function(room) {
        const status = {
            energy: room.energyAvailable,
            energyCapacity: room.energyCapacityAvailable,
            constructionSites: room.find(FIND_CONSTRUCTION_SITES).length,
            damagedStructures: room.find(FIND_STRUCTURES, {
                filter: s => s.hits < s.hitsMax && s.structureType !== STRUCTURE_WALL
            }).length,
            hostiles: room.find(FIND_HOSTILE_CREEPS).length,
            creeps: room.find(FIND_MY_CREEPS).length,
            storage: room.storage ? room.storage.store[RESOURCE_ENERGY] : 0,
            storageCapacity: room.storage ? room.storage.store.getCapacity(RESOURCE_ENERGY) : 0,
            containers: room.find(FIND_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_CONTAINER
            }).length,
            energyLevel: 0,
            threatLevel: 0,
            performance: {
                cpu: Game.cpu.getUsed()
            }
        };

        // 计算能量水平
        status.energyLevel = status.energy / status.energyCapacity;

        // 计算威胁等级
        if(status.hostiles > 0) {
            const hostiles = room.find(FIND_HOSTILE_CREEPS);
            let threatScore = 0;
            hostiles.forEach(hostile => {
                threatScore += hostile.getActiveBodyparts(ATTACK) * 2;
                threatScore += hostile.getActiveBodyparts(RANGED_ATTACK) * 2;
                threatScore += hostile.getActiveBodyparts(HEAL) * 3;
                threatScore += hostile.getActiveBodyparts(TOUGH);
            });
            status.threatLevel = Math.min(5, Math.ceil(threatScore / 10));
        }

        return status;
    },

    // 计算两点之间的距离
    calculateDistance: function(pos1, pos2) {
        return Math.max(Math.abs(pos1.x - pos2.x), Math.abs(pos1.y - pos2.y));
    },

    // 获取最近的能量源
    findClosestEnergySource: function(pos, room) {
        const sources = room.find(FIND_SOURCES);
        let closest = null;
        let minDistance = Infinity;

        for(let source of sources) {
            const distance = this.calculateDistance(pos, source.pos);
            if(distance < minDistance) {
                minDistance = distance;
                closest = source;
            }
        }

        return closest;
    },

    // 检查路径是否被阻塞
    isPathBlocked: function(startPos, endPos, room) {
        const path = room.findPath(startPos, endPos, {
            ignoreCreeps: true
        });
        
        return path.length === 0;
    },

    // 获取建筑健康状态
    getStructureHealth: function(structure) {
        return {
            current: structure.hits,
            max: structure.hitsMax,
            percentage: (structure.hits / structure.hitsMax) * 100
        };
    },

    // 计算房间能量分布
    calculateEnergyDistribution: function(room) {
        const structures = room.find(FIND_STRUCTURES);
        let distribution = {
            spawns: 0,
            extensions: 0,
            towers: 0,
            storage: 0,
            terminal: 0,
            containers: 0
        };

        for(let structure of structures) {
            if(structure.store && structure.store[RESOURCE_ENERGY]) {
                switch(structure.structureType) {
                    case STRUCTURE_SPAWN:
                        distribution.spawns += structure.store[RESOURCE_ENERGY];
                        break;
                    case STRUCTURE_EXTENSION:
                        distribution.extensions += structure.store[RESOURCE_ENERGY];
                        break;
                    case STRUCTURE_TOWER:
                        distribution.towers += structure.store[RESOURCE_ENERGY];
                        break;
                    case STRUCTURE_STORAGE:
                        distribution.storage += structure.store[RESOURCE_ENERGY];
                        break;
                    case STRUCTURE_TERMINAL:
                        distribution.terminal += structure.store[RESOURCE_ENERGY];
                        break;
                    case STRUCTURE_CONTAINER:
                        distribution.containers += structure.store[RESOURCE_ENERGY];
                        break;
                }
            }
        }

        return distribution;
    },

    // 检查能量紧急状态
    checkEnergyEmergency: function(room) {
        const status = this.getRoomStatus(room);
        const emergency = {
            isEmergency: false,
            level: 0,
            reason: ''
        };

        // 检查能量水平
        if(status.energyLevel < 0.2) {
            emergency.isEmergency = true;
            emergency.level = 3;
            emergency.reason = '能量严重不足';
        }
        else if(status.energyLevel < 0.4) {
            emergency.isEmergency = true;
            emergency.level = 2;
            emergency.reason = '能量不足';
        }

        // 检查存储能量
        if(status.storage > 0 && status.storage < 1000) {
            emergency.isEmergency = true;
            emergency.level = Math.max(emergency.level, 1);
            emergency.reason += ' 存储能量不足';
        }

        return emergency;
    },

    // 获取能量分配策略
    getEnergyStrategy: function(room) {
        const status = this.getRoomStatus(room);
        const emergency = this.checkEnergyEmergency(room);
        
        return {
            emergency: emergency.isEmergency,
            emergencyLevel: emergency.level,
            reason: emergency.reason,
            priorities: {
                spawn: emergency.isEmergency ? 1 : 2,
                extension: emergency.isEmergency ? 2 : 3,
                tower: emergency.isEmergency ? 3 : 4,
                storage: emergency.isEmergency ? 4 : 1
            },
            thresholds: {
                spawn: emergency.isEmergency ? 0.5 : 0.8,
                extension: emergency.isEmergency ? 0.3 : 0.6,
                tower: emergency.isEmergency ? 0.2 : 0.4,
                storage: emergency.isEmergency ? 0.1 : 0.2
            }
        };
    },

    // 记录房间状态
    recordRoomStatus: function(room) {
        if(!room.memory.status) {
            room.memory.status = {
                history: [],
                lastUpdate: 0,
                performance: {
                    cpu: []
                }
            };
        }

        const status = this.getRoomStatus(room);
        const now = Game.time;

        // 每100 tick记录一次状态
        if(now - room.memory.status.lastUpdate >= 100) {
            room.memory.status.history.push({
                time: now,
                energy: status.energy,
                energyCapacity: status.energyCapacity,
                constructionSites: status.constructionSites,
                damagedStructures: status.damagedStructures,
                hostiles: status.hostiles,
                creeps: status.creeps,
                storage: status.storage,
                energyLevel: status.energyLevel,
                threatLevel: status.threatLevel
            });

            // 只保留最近100条记录
            if(room.memory.status.history.length > 100) {
                room.memory.status.history.shift();
            }

            // 记录性能数据
            room.memory.status.performance.cpu.push(status.performance.cpu);

            // 只保留最近1000条性能记录
            if(room.memory.status.performance.cpu.length > 1000) {
                room.memory.status.performance.cpu.shift();
            }

            room.memory.status.lastUpdate = now;
        }
    },

    // 获取性能统计
    getPerformanceStats: function(room) {
        if(!room.memory.status || !room.memory.status.performance) {
            return null;
        }

        const cpu = room.memory.status.performance.cpu;

        return {
            cpu: {
                average: cpu.reduce((a, b) => a + b, 0) / cpu.length,
                max: Math.max(...cpu),
                min: Math.min(...cpu)
            }
        };
    },

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