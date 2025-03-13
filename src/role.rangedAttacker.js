module.exports = {
    run: function(creep) {
        // 找到最近的敌人
        const target = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
        
        if(target) {
            // 保持在射程范围内（3格）
            const range = creep.pos.getRangeTo(target);
            
            if(range <= 3) {
                // 在射程内就攻击
                creep.rangedAttack(target);
                // 如果敌人太近，就后退
                if(range <= 1) {
                    const fleePath = PathFinder.search(creep.pos, {
                        pos: target.pos,
                        range: 3
                    }, {
                        flee: true
                    });
                    creep.moveByPath(fleePath.path);
                }
            }
            // 如果不在射程内，就靠近
            else {
                creep.moveTo(target, {
                    visualizePathStyle: {stroke: '#ff0000'},
                    range: 3
                });
            }
        }
        // 如果没有敌人，跟随最近的防御者
        else {
            const defender = creep.pos.findClosestByRange(FIND_MY_CREEPS, {
                filter: (c) => c.memory.role == 'defender'
            });
            
            if(defender) {
                // 保持在防御者附近2格范围内
                if(creep.pos.getRangeTo(defender) > 2) {
                    creep.moveTo(defender, {visualizePathStyle: {stroke: '#ff0000'}});
                }
            }
            // 如果没有防御者，回到spawn附近巡逻
            else {
                const spawn = creep.room.find(FIND_MY_SPAWNS)[0];
                if(spawn && creep.pos.getRangeTo(spawn) > 3) {
                    creep.moveTo(spawn, {visualizePathStyle: {stroke: '#ff0000'}});
                }
            }
        }

        // 质量攻击：当周围有多个敌人时
        const nearbyHostiles = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 3);
        if(nearbyHostiles.length > 1) {
            creep.rangedMassAttack();
        }
    }
}; 