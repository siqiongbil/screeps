// strongHarvester.js
module.exports.run = function (creep) {
    if (creep.store.getFreeCapacity() > 0) {
        // 查找最近的 Source 进行采集
        const sources = creep.room.find(FIND_SOURCES_ACTIVE);
        let source = creep.memory.source ? Game.getObjectById(creep.memory.source) : null;

        if (!source || source.energy === 0) {
            // 如果当前 source 无效或没有能量，选择新的 source
            source = creep.pos.findClosestByPath(sources);
            creep.memory.source = source ? source.id : null;
        } else {
            // 检查当前 source 是否有空闲的开采位置
            const harvesters = source.pos.findInRange(FIND_MY_CREEPS, 1, {
                filter: c => c.memory.role === 'strongHarvester'
            });
            if (harvesters.length >= source.energyCapacity / 300) { // 假设每个 source 最多支持 3 个 strongHarvester
                // 当前 source 没有空闲的开采位置，选择新的 source
                source = creep.pos.findClosestByPath(sources, {
                    filter: s => {
                        const sHarvesters = s.pos.findInRange(FIND_MY_CREEPS, 1, {
                            filter: c => c.memory.role === 'strongHarvester'
                        });
                        return sHarvesters.length < s.energyCapacity / 300;
                    }
                });
                creep.memory.source = source ? source.id : null;
            }
        }

        if (source) {
            if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
                creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } });
            }
            return;
        }
    } else {
        // 查找最近的 Storage 存放能量
        const storage = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: structure =>
                structure.structureType === STRUCTURE_STORAGE &&
                structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0 &&
                structure.room.name === creep.room.name
        });
        if (storage) {
            if (creep.transfer(storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(storage, { visualizePathStyle: { stroke: '#ffffff' } });
            }
            return;
        }

        // 查找最近的 Extension 存放能量
        const extensions = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: structure =>
                structure.structureType === STRUCTURE_EXTENSION &&
                structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0 &&
                structure.room.name === creep.room.name
        });
        if (extensions) {
            if (creep.transfer(extensions, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(extensions, { visualizePathStyle: { stroke: '#ffffff' } });
            }
            return;
        }

        // 查找最近的 Spawn 存放能量
        const spawn = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: structure =>
                structure.structureType === STRUCTURE_SPAWN &&
                structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0 &&
                structure.room.name === creep.room.name
        });
        if (spawn) {
            if (creep.transfer(spawn, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(spawn, { visualizePathStyle: { stroke: '#ffffff' } });
            }
        }
    }
};