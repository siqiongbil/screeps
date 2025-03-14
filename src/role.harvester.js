module.exports = {
    run: function(creep) {
        // 检查是否处于紧急状态
        const isEmergency = creep.memory.emergency || 
                           (creep.room.memory.emergencyFlags && creep.room.memory.emergencyFlags.prioritizeHarvesting);
        
        // 初始化状态计数器
        if(!creep.memory.stateCounter) {
            creep.memory.stateCounter = {
                working: 0,
                harvesting: 0,
                lastState: creep.memory.working ? 'working' : 'harvesting',
                stateChangeTime: Game.time
            };
        }
        
        // 记录当前状态
        const oldState = creep.memory.working ? 'working' : 'harvesting';
        
        // 使用原型方法更新工作状态
        creep.updateWorkingState();
        
        // 记录新状态
        const newState = creep.memory.working ? 'working' : 'harvesting';
        
        // 如果状态发生变化，更新计数器
        if(oldState !== newState) {
            // 如果状态变化太频繁（在短时间内多次切换），强制保持当前状态一段时间
            const timeSinceLastChange = Game.time - creep.memory.stateCounter.stateChangeTime;
            if(timeSinceLastChange < 10) { // 如果在10个tick内再次切换状态
                creep.memory.stateCounter[newState]++;
                
                // 如果频繁切换次数过多，强制保持当前状态
                if(creep.memory.stateCounter[newState] > 3) {
                    console.log(`Creep ${creep.name} 状态切换过于频繁，强制保持 ${oldState} 状态`);
                    creep.memory.working = (oldState === 'working');
                    
                    // 重置计数器
                    creep.memory.stateCounter = {
                        working: 0,
                        harvesting: 0,
                        lastState: oldState,
                        stateChangeTime: Game.time,
                        forcedState: true,
                        forcedUntil: Game.time + 30 // 强制保持30个tick
                    };
                    
                    // 如果被强制保持采集状态但没有能量，尝试从掉落的能量中获取
                    if(oldState === 'harvesting' && creep.store.getFreeCapacity() === 0) {
                        // 寻找掉落的能量
                        const droppedEnergy = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
                            filter: r => r.resourceType === RESOURCE_ENERGY
                        });
                        
                        if(droppedEnergy) {
                            if(creep.pickup(droppedEnergy) === ERR_NOT_IN_RANGE) {
                                creep.moveTo(droppedEnergy, {visualizePathStyle: {stroke: '#ffaa00'}});
                            }
                            return;
                        }
                    }
                }
            } else {
                // 正常状态变化，重置计数器
                creep.memory.stateCounter = {
                    working: 0,
                    harvesting: 0,
                    lastState: newState,
                    stateChangeTime: Game.time
                };
            }
        }
        
        // 检查是否处于强制状态
        if(creep.memory.stateCounter.forcedState) {
            if(Game.time < creep.memory.stateCounter.forcedUntil) {
                // 仍在强制状态期间
                if(creep.memory.working) {
                    // 强制工作状态
                    this.doWork(creep, isEmergency);
                } else {
                    // 强制采集状态
                    this.doHarvest(creep, isEmergency);
                }
                return;
            } else {
                // 强制状态结束
                delete creep.memory.stateCounter.forcedState;
                delete creep.memory.stateCounter.forcedUntil;
            }
        }

        // 如果在工作状态，就去转移能量
        if(creep.memory.working) {
            this.doWork(creep, isEmergency);
        }
        else {
            this.doHarvest(creep, isEmergency);
        }
    },
    
    // 执行工作（转移能量）
    doWork: function(creep, isEmergency) {
        // 在紧急情况下，优先向spawn和extension提供能量
        if(isEmergency) {
            const targets = creep.room.find(FIND_STRUCTURES, {
                filter: (structure) => {
                    return (structure.structureType === STRUCTURE_EXTENSION ||
                            structure.structureType === STRUCTURE_SPAWN) && 
                            structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                }
            });
            
            if(targets.length > 0) {
                // 按能量缺口排序，优先填充能量缺口最大的建筑
                targets.sort((a, b) => {
                    return b.store.getFreeCapacity(RESOURCE_ENERGY) - a.store.getFreeCapacity(RESOURCE_ENERGY);
                });
                
                if(creep.transfer(targets[0], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(targets[0], {
                        visualizePathStyle: {stroke: '#ffffff'},
                        reusePath: 5
                    });
                }
                return;
            }
        }
        
        // 使用原型方法转移能量
        if(!creep.transferEnergy()) {
            // 如果没有建筑需要能量，就去升级控制器
            if(creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                creep.moveTo(creep.room.controller, {
                    visualizePathStyle: {stroke: '#ffffff'},
                    reusePath: 5
                });
            }
        }
    },
    
    // 执行采集
    doHarvest: function(creep, isEmergency) {
        // 在紧急情况下，直接从能量源采集
        if(isEmergency) {
            creep.harvestOptimalSource();
            return;
        }
        
        // 先尝试从容器获取能量
        if(creep.withdrawFromContainer()) {
            return;
        }
        
        // 如果没有可用的容器，再从能量源采集
        creep.harvestOptimalSource();
    }
}; 