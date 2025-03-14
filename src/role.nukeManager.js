/**
 * 核弹管理者角色
 * 负责装填核弹发射井
 */
module.exports = {
    run: function(creep) {
        // 使用原型方法更新工作状态
        creep.updateWorkingState();
        
        // 如果房间没有核弹发射井，转为普通运输者
        const nuker = creep.room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_NUKER
        })[0];
        
        if(!nuker) {
            creep.memory.role = 'carrier';
            return;
        }
        
        // 如果在工作状态，就去填充核弹发射井
        if(creep.memory.working) {
            // 确定要填充的资源类型
            let resourceType = RESOURCE_ENERGY;
            
            // 如果creep携带G资源，优先填充G资源
            if(creep.store[RESOURCE_GHODIUM] > 0) {
                resourceType = RESOURCE_GHODIUM;
            } 
            // 如果creep只携带能量，且核弹发射井能量已满，转为升级控制器
            else if(creep.store[RESOURCE_ENERGY] > 0 && nuker.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
                if(creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(creep.room.controller, {
                        visualizePathStyle: {stroke: '#ffffff'},
                        reusePath: 5
                    });
                }
                return;
            }
            
            // 填充核弹发射井
            if(creep.transfer(nuker, resourceType) === ERR_NOT_IN_RANGE) {
                creep.moveTo(nuker, {
                    visualizePathStyle: {stroke: '#ffffff'},
                    reusePath: 5
                });
            }
        } else {
            // 如果不在工作状态，就去收集资源
            
            // 确定要收集的资源类型
            let resourceType = RESOURCE_ENERGY;
            
            // 如果核弹发射井G资源未满，优先收集G资源
            if(nuker.store.getFreeCapacity(RESOURCE_GHODIUM) > 0) {
                resourceType = RESOURCE_GHODIUM;
            }
            // 如果核弹发射井能量已满，转为升级控制器
            else if(nuker.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
                if(creep.store.getUsedCapacity() === 0) {
                    // 收集能量用于升级控制器
                    creep.harvestEnergy();
                } else {
                    // 如果已经有能量，去升级控制器
                    if(creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(creep.room.controller, {
                            visualizePathStyle: {stroke: '#ffffff'},
                            reusePath: 5
                        });
                    }
                }
                return;
            }
            
            // 优先从终端获取资源
            if(creep.room.terminal && creep.room.terminal.store[resourceType] > 0) {
                if(creep.withdraw(creep.room.terminal, resourceType) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(creep.room.terminal, {
                        visualizePathStyle: {stroke: '#ffaa00'},
                        reusePath: 5
                    });
                }
                return;
            }
            
            // 其次从存储获取资源
            if(creep.room.storage && creep.room.storage.store[resourceType] > 0) {
                if(creep.withdraw(creep.room.storage, resourceType) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(creep.room.storage, {
                        visualizePathStyle: {stroke: '#ffaa00'},
                        reusePath: 5
                    });
                }
                return;
            }
            
            // 如果是能量，可以从容器或直接采集
            if(resourceType === RESOURCE_ENERGY) {
                // 从容器获取能量
                const containers = creep.room.find(FIND_STRUCTURES, {
                    filter: s => s.structureType === STRUCTURE_CONTAINER && 
                              s.store[RESOURCE_ENERGY] > 100
                });
                
                if(containers.length > 0) {
                    const container = creep.pos.findClosestByPath(containers);
                    if(creep.withdraw(container, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(container, {
                            visualizePathStyle: {stroke: '#ffaa00'},
                            reusePath: 5
                        });
                    }
                    return;
                }
                
                // 直接采集能量
                creep.harvestEnergy();
            } else {
                // 如果找不到G资源，显示提示并转为普通运输者
                console.log(`[NukeManager] 房间 ${creep.room.name} 中没有可用的G资源`);
                creep.say('找不到G');
                
                // 如果已经有能量，去填充核弹发射井
                if(creep.store[RESOURCE_ENERGY] > 0) {
                    if(creep.transfer(nuker, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(nuker, {
                            visualizePathStyle: {stroke: '#ffffff'},
                            reusePath: 5
                        });
                    }
                } else {
                    // 收集能量
                    creep.harvestEnergy();
                }
            }
        }
    }
}; 