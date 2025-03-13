module.exports = {
    run: function(creep) {
        // 找到受伤的友方creep
        const injuredCreep = creep.pos.findClosestByRange(FIND_MY_CREEPS, {
            filter: (c) => c.hits < c.hitsMax
        });

        // 如果有受伤的creep
        if(injuredCreep) {
            // 如果不在治疗范围内，移动过去
            if(creep.heal(injuredCreep) == ERR_NOT_IN_RANGE) {
                creep.moveTo(injuredCreep, {visualizePathStyle: {stroke: '#00ff00'}});
                // 远程治疗
                creep.rangedHeal(injuredCreep);
            }
        }
        // 如果没有受伤的creep，跟随防御者
        else {
            const defender = creep.pos.findClosestByRange(FIND_MY_CREEPS, {
                filter: (c) => c.memory.role == 'defender'
            });
            
            if(defender) {
                // 保持在防御者附近2格范围内
                if(creep.pos.getRangeTo(defender) > 2) {
                    creep.moveTo(defender, {visualizePathStyle: {stroke: '#00ff00'}});
                }
            }
            // 如果没有防御者，回到spawn附近
            else {
                const spawn = creep.room.find(FIND_MY_SPAWNS)[0];
                if(spawn && creep.pos.getRangeTo(spawn) > 3) {
                    creep.moveTo(spawn, {visualizePathStyle: {stroke: '#00ff00'}});
                }
            }
        }

        // 自我治疗
        if(creep.hits < creep.hitsMax) {
            creep.heal(creep);
        }
    }
}; 