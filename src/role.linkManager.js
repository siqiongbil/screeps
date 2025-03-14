/**
 * 链接网络管理者角色
 * 负责收集能量并填充发送链接
 */
module.exports = {
    run: function(creep) {
        // 使用原型方法更新工作状态
        creep.updateWorkingState();
        
        // 如果房间没有链接网络，转为普通采集者
        if(!creep.room.memory.linkNetwork) {
            creep.memory.role = 'harvester';
            return;
        }
        
        // 获取链接网络信息
        const linkNetwork = creep.room.memory.linkNetwork;
        
        // 如果在工作状态，就去填充发送链接
        if(creep.memory.working) {
            // 获取需要填充的发送链接
            const senderLinks = linkNetwork.links.senders
                .map(id => Game.getObjectById(id))
                .filter(link => link && link.store.getFreeCapacity(RESOURCE_ENERGY) > 0)
                .sort((a, b) => a.store[RESOURCE_ENERGY] - b.store[RESOURCE_ENERGY]); // 能量最少的优先填充
            
            if(senderLinks.length > 0) {
                // 填充链接
                if(creep.transfer(senderLinks[0], RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(senderLinks[0], {
                        visualizePathStyle: {stroke: '#ffffff'},
                        reusePath: 5
                    });
                }
            } else {
                // 如果没有需要填充的链接，去升级控制器
                if(creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(creep.room.controller, {
                        visualizePathStyle: {stroke: '#ffffff'},
                        reusePath: 5
                    });
                }
            }
        } else {
            // 如果不在工作状态，就去收集能量
            
            // 优先从存储获取能量
            if(creep.room.storage && creep.room.storage.store[RESOURCE_ENERGY] > 1000) {
                if(creep.withdraw(creep.room.storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(creep.room.storage, {
                        visualizePathStyle: {stroke: '#ffaa00'},
                        reusePath: 5
                    });
                }
                return;
            }
            
            // 其次从接收链接获取能量
            const receiverLinks = linkNetwork.links.receivers
                .map(id => Game.getObjectById(id))
                .filter(link => link && link.store[RESOURCE_ENERGY] > 0)
                .sort((a, b) => b.store[RESOURCE_ENERGY] - a.store[RESOURCE_ENERGY]); // 能量最多的优先获取
            
            if(receiverLinks.length > 0) {
                if(creep.withdraw(receiverLinks[0], RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(receiverLinks[0], {
                        visualizePathStyle: {stroke: '#ffaa00'},
                        reusePath: 5
                    });
                }
                return;
            }
            
            // 最后从容器获取能量
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
            
            // 如果没有可用的能量源，使用通用的采集方法
            creep.harvestEnergy();
        }
    }
}; 