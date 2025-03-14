/**
 * 矿物采集者角色
 * 专门用于采集矿物资源，需要控制器等级6及以上
 * 需要矿物提取器(STRUCTURE_EXTRACTOR)建造在矿物上
 */
module.exports = {
    run: function(creep) {
        // 如果没有指定矿物ID，尝试找到一个矿物
        if(!creep.memory.mineralId) {
            const minerals = creep.room.find(FIND_MINERALS);
            if(minerals.length > 0) {
                creep.memory.mineralId = minerals[0].id;
            } else {
                // 如果房间中没有矿物，转为普通采集者
                creep.memory.role = 'harvester';
                return;
            }
        }
        
        // 获取指定的矿物
        const mineral = Game.getObjectById(creep.memory.mineralId);
        if(!mineral) {
            // 如果矿物不存在，重置矿物ID
            delete creep.memory.mineralId;
            return;
        }
        
        // 检查矿物是否有提取器
        const extractor = mineral.pos.lookFor(LOOK_STRUCTURES).find(
            s => s.structureType === STRUCTURE_EXTRACTOR
        );
        
        if(!extractor) {
            // 如果没有提取器，提示需要建造提取器
            creep.say('需要提取器');
            // 移动到矿物附近
            if(!creep.pos.inRangeTo(mineral, 3)) {
                creep.moveTo(mineral, {visualizePathStyle: {stroke: '#ffaa00'}});
            }
            return;
        }
        
        // 使用原型方法更新工作状态
        if(creep.memory.working && creep.store.getFreeCapacity() === 0) {
            creep.memory.working = false;
        }
        if(!creep.memory.working && creep.store.getUsedCapacity() === 0) {
            creep.memory.working = true;
        }
        
        // 如果在工作状态，就去采集矿物
        if(creep.memory.working) {
            // 检查矿物是否有剩余量和冷却时间
            if(mineral.mineralAmount === 0) {
                creep.say('矿物耗尽');
                // 如果矿物已耗尽，转为普通采集者
                if(mineral.ticksToRegeneration > 1000) {
                    creep.memory.role = 'harvester';
                }
                return;
            }
            
            // 采集矿物
            if(creep.harvest(mineral) === ERR_NOT_IN_RANGE) {
                creep.moveTo(mineral, {visualizePathStyle: {stroke: '#ffaa00'}});
            }
        }
        // 如果不在工作状态，就去存储矿物
        else {
            // 优先存储到终端
            const terminal = creep.room.terminal;
            if(terminal && terminal.store.getFreeCapacity() > 0) {
                if(creep.transfer(terminal, mineral.mineralType) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(terminal, {visualizePathStyle: {stroke: '#ffffff'}});
                }
                return;
            }
            
            // 其次存储到仓库
            const storage = creep.room.storage;
            if(storage && storage.store.getFreeCapacity() > 0) {
                if(creep.transfer(storage, mineral.mineralType) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(storage, {visualizePathStyle: {stroke: '#ffffff'}});
                }
                return;
            }
            
            // 最后尝试存储到容器
            const containers = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_CONTAINER && 
                            s.store.getFreeCapacity() > 0
            });
            
            if(containers) {
                if(creep.transfer(containers, mineral.mineralType) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(containers, {visualizePathStyle: {stroke: '#ffffff'}});
                }
                return;
            }
            
            // 如果没有可用的存储设施，就站在矿物旁边等待
            creep.say('存储已满');
            if(!creep.pos.inRangeTo(mineral, 2)) {
                creep.moveTo(mineral, {visualizePathStyle: {stroke: '#ffaa00'}});
            }
        }
    }
}; 