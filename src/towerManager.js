/**
 * 防御塔管理模块
 * 负责控制防御塔的攻击、治疗和修理行为
 */
module.exports = {
    // 主运行函数
    run: function(room) {
        const towers = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_TOWER
        });

        towers.forEach(tower => {
            if(tower.store[RESOURCE_ENERGY] > 0) {
                // 优先攻击敌人
                const hostiles = room.find(FIND_HOSTILE_CREEPS);
                if(hostiles.length > 0) {
                    const target = tower.pos.findClosestByRange(hostiles);
                    tower.attack(target);
                    return;
                }

                // 其次治疗受伤的creeps
                const injuredCreeps = room.find(FIND_MY_CREEPS, {
                    filter: c => c.hits < c.hitsMax
                });
                if(injuredCreeps.length > 0) {
                    const target = tower.pos.findClosestByRange(injuredCreeps);
                    tower.heal(target);
                    return;
                }

                // 最后修理受损建筑
                if(tower.store[RESOURCE_ENERGY] > tower.store.getCapacity(RESOURCE_ENERGY) * 0.7) {
                    const damagedStructures = room.find(FIND_STRUCTURES, {
                        filter: s => s.hits < s.hitsMax && 
                                    s.structureType !== STRUCTURE_WALL && 
                                    s.structureType !== STRUCTURE_RAMPART
                    });
                    if(damagedStructures.length > 0) {
                        const target = tower.pos.findClosestByRange(damagedStructures);
                        tower.repair(target);
                    }
                }
            }
        });
    },

    // 紧急模式 - 只攻击敌人
    emergencyMode: function(room) {
        const towers = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_TOWER
        });

        towers.forEach(tower => {
            if(tower.store[RESOURCE_ENERGY] > 0) {
                const hostiles = room.find(FIND_HOSTILE_CREEPS);
                if(hostiles.length > 0) {
                    const target = tower.pos.findClosestByRange(hostiles);
                    tower.attack(target);
                }
            }
        });
    },

    // 修理模式 - 只修理建筑
    repairMode: function(room) {
        const towers = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_TOWER
        });

        towers.forEach(tower => {
            if(tower.store[RESOURCE_ENERGY] > tower.store.getCapacity(RESOURCE_ENERGY) * 0.5) {
                const damagedStructures = room.find(FIND_STRUCTURES, {
                    filter: s => s.hits < s.hitsMax && 
                                s.structureType !== STRUCTURE_WALL && 
                                s.structureType !== STRUCTURE_RAMPART
                });
                if(damagedStructures.length > 0) {
                    const target = tower.pos.findClosestByRange(damagedStructures);
                    tower.repair(target);
                }
            }
        });
    },

    // 治疗模式 - 只治疗creeps
    healMode: function(room) {
        const towers = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_TOWER
        });

        towers.forEach(tower => {
            if(tower.store[RESOURCE_ENERGY] > 0) {
                const injuredCreeps = room.find(FIND_MY_CREEPS, {
                    filter: c => c.hits < c.hitsMax
                });
                if(injuredCreeps.length > 0) {
                    const target = tower.pos.findClosestByRange(injuredCreeps);
                    tower.heal(target);
                }
            }
        });
    }
}; 