module.exports = {
    // 根据控制器等级获取防御者配置
    getDefenderConfig: function(room) {
        const level = room.controller.level;
        const configs = {
            // 等级1-2：基础防御者
            basic: {
                body: [TOUGH, MOVE, ATTACK, MOVE],
                memory: { role: 'defender', type: 'basic' }
            },
            // 等级3-4：进阶防御者
            advanced: {
                body: [TOUGH, TOUGH, MOVE, MOVE, ATTACK, ATTACK, RANGED_ATTACK, MOVE],
                memory: { role: 'defender', type: 'advanced' }
            },
            // 等级5-6：精英防御者
            elite: {
                body: [TOUGH, TOUGH, MOVE, MOVE, ATTACK, ATTACK, RANGED_ATTACK, RANGED_ATTACK, HEAL, MOVE, MOVE],
                memory: { role: 'defender', type: 'elite' }
            },
            // 等级7-8：超级防御者
            super: {
                body: [TOUGH, TOUGH, TOUGH, MOVE, MOVE, MOVE, ATTACK, ATTACK, RANGED_ATTACK, RANGED_ATTACK, HEAL, HEAL, MOVE, MOVE],
                memory: { role: 'defender', type: 'super' }
            }
        };

        if(level >= 7) return configs.super;
        if(level >= 5) return configs.elite;
        if(level >= 3) return configs.advanced;
        return configs.basic;
    },

    run: function(creep) {
        // 根据防御者类型设置不同的撤退阈值
        const retreatThresholds = {
            'basic': 0.5,
            'advanced': 0.4,
            'elite': 0.3,
            'super': 0.25
        };
        
        const retreatThreshold = retreatThresholds[creep.memory.type] || 0.5;
        
        // 检查生命值，根据类型决定撤退阈值
        if(creep.hits < creep.hitsMax * retreatThreshold) {
            this.retreat(creep);
            return;
        }

        const hostiles = creep.room.find(FIND_HOSTILE_CREEPS);
        
        if(hostiles.length > 0) {
            // 分析敌人威胁等级
            const threats = this.analyzeThreat(hostiles);
            
            // 根据防御者类型选择战术
            switch(creep.memory.type) {
                case 'super':
                case 'elite':
                    this.executeEliteTactics(creep, threats);
                    break;
                case 'advanced':
                    this.executeAdvancedTactics(creep, threats);
                    break;
                default:
                    this.executeBasicTactics(creep, threats);
            }
        } else {
            this.peacetimeBehavior(creep);
        }
    },

    // 精英战术
    executeEliteTactics: function(creep, threats) {
        // 优先处理最危险的敌人
        const dangerousEnemies = this.findDangerousEnemies(threats);
        if(dangerousEnemies.length > 0) {
            const target = this.selectBestTarget(creep, dangerousEnemies);
            this.engage(creep, target, true);
            return;
        }
        
        // 如果没有危险敌人，执行标准战术
        this.executeAdvancedTactics(creep, threats);
    },

    // 进阶战术
    executeAdvancedTactics: function(creep, threats) {
        // 优先处理治疗者
        if(threats.healers.length > 0) {
            const target = creep.pos.findClosestByPath(threats.healers);
            this.engage(creep, target);
            return;
        }
        
        // 处理其他威胁
        this.executeBasicTactics(creep, threats);
    },

    // 基础战术
    executeBasicTactics: function(creep, threats) {
        // 处理最近的敌人
        const target = creep.pos.findClosestByPath(FIND_HOSTILE_CREEPS);
        if(target) {
            this.engage(creep, target);
        }
    },

    // 分析敌人威胁
    analyzeThreat: function(hostiles) {
        return {
            healers: hostiles.filter(c => c.getActiveBodyparts(HEAL) > 0),
            attackers: hostiles.filter(c => c.getActiveBodyparts(ATTACK) > 0),
            ranged: hostiles.filter(c => c.getActiveBodyparts(RANGED_ATTACK) > 0),
            dangerous: hostiles.filter(c => 
                c.getActiveBodyparts(HEAL) > 2 || 
                c.getActiveBodyparts(ATTACK) > 2 ||
                c.getActiveBodyparts(RANGED_ATTACK) > 2
            )
        };
    },

    // 寻找危险敌人
    findDangerousEnemies: function(threats) {
        return threats.dangerous;
    },

    // 选择最佳目标
    selectBestTarget: function(creep, enemies) {
        return enemies.reduce((best, current) => {
            if(!best) return current;
            
            // 计算目标价值
            const currentValue = this.calculateTargetValue(current);
            const bestValue = this.calculateTargetValue(best);
            
            return currentValue > bestValue ? current : best;
        }, null);
    },

    // 计算目标价值
    calculateTargetValue: function(target) {
        let value = 0;
        value += target.getActiveBodyparts(HEAL) * 3;
        value += target.getActiveBodyparts(ATTACK) * 2;
        value += target.getActiveBodyparts(RANGED_ATTACK) * 2;
        value += target.getActiveBodyparts(TOUGH);
        value -= target.hits / target.hitsMax; // 受伤的敌人更容易成为目标
        return value;
    },

    // 战斗逻辑
    engage: function(creep, target, isAggressive = false) {
        const range = creep.pos.getRangeTo(target);
        
        // 根据类型使用不同的战斗策略
        if(creep.memory.type === 'super' || creep.memory.type === 'elite') {
            this.advancedCombat(creep, target, range, isAggressive);
        } else {
            this.basicCombat(creep, target, range);
        }
    },

    // 高级战斗逻辑
    advancedCombat: function(creep, target, range, isAggressive) {
        // 远程攻击逻辑
        if(creep.getActiveBodyparts(RANGED_ATTACK) > 0) {
            if(range <= 3) {
                // 使用群体远程攻击
                const nearbyHostiles = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 3);
                if(nearbyHostiles.length > 1) {
                    creep.rangedMassAttack();
                } else {
                    creep.rangedAttack(target);
                }
            }
        }
        
        // 近战攻击逻辑
        if(creep.getActiveBodyparts(ATTACK) > 0 && range <= 1) {
            creep.attack(target);
        }
        
        // 治疗逻辑
        if(creep.getActiveBodyparts(HEAL) > 0) {
            const hurtAlly = this.findMostHurtAlly(creep);
            if(hurtAlly) {
                const healRange = creep.pos.getRangeTo(hurtAlly);
                if(healRange <= 1) {
                    creep.heal(hurtAlly);
                } else if(healRange <= 3) {
                    creep.rangedHeal(hurtAlly);
                }
            }
        }
        
        // 移动逻辑
        this.tacticalMove(creep, target, isAggressive);
    },

    // 基础战斗逻辑
    basicCombat: function(creep, target, range) {
        if(creep.getActiveBodyparts(RANGED_ATTACK) > 0 && range <= 3) {
            creep.rangedAttack(target);
        }
        
        if(creep.getActiveBodyparts(ATTACK) > 0 && range <= 1) {
            creep.attack(target);
        }
        
        if(range > 1) {
            creep.moveTo(target, {
                visualizePathStyle: {stroke: '#ff0000'},
                maxRooms: 1,
                reusePath: 5
            });
        }
    },

    // 战术移动
    tacticalMove: function(creep, target, isAggressive) {
        const range = creep.pos.getRangeTo(target);
        let optimalRange = 3; // 默认保持在射程范围内
        
        if(isAggressive && creep.getActiveBodyparts(ATTACK) > 0) {
            optimalRange = 1; // 如果是进攻模式且有近战攻击，则接近目标
        }
        
        if(range > optimalRange) {
            creep.moveTo(target, {
                visualizePathStyle: {stroke: '#ff0000'},
                maxRooms: 1,
                reusePath: 3
            });
        } else if(range < optimalRange) {
            // 保持距离
            const direction = creep.pos.getDirectionTo(target);
            creep.move((direction + 4) % 8);
        }
    },

    // 和平时期行为
    peacetimeBehavior: function(creep) {
        if(creep.hits < creep.hitsMax) {
            this.selfHeal(creep);
        } else {
            const hurtCreep = this.findMostHurtAlly(creep);
            if(hurtCreep) {
                this.healOthers(creep, hurtCreep);
            } else {
                this.patrol(creep);
            }
        }
    },

    // 寻找最需要治疗的盟友
    findMostHurtAlly: function(creep) {
        const hurtAllies = creep.room.find(FIND_MY_CREEPS, {
            filter: c => c.hits < c.hitsMax && c.id !== creep.id
        });
        
        return hurtAllies.reduce((mostHurt, current) => {
            if(!mostHurt) return current;
            return (current.hitsMax - current.hits) > (mostHurt.hitsMax - mostHurt.hits) ? current : mostHurt;
        }, null);
    },

    // 撤退逻辑
    retreat: function(creep) {
        const spawn = creep.pos.findClosestByPath(FIND_MY_SPAWNS);
        if(spawn) {
            creep.moveTo(spawn, {
                visualizePathStyle: {stroke: '#ffff00'},
                maxRooms: 1,
                reusePath: 3
            });
        }
        
        // 撤退时自我治疗
        if(creep.getActiveBodyparts(HEAL) > 0) {
            creep.heal(creep);
        }
    },

    // 自我治疗
    selfHeal: function(creep) {
        if(creep.getActiveBodyparts(HEAL) > 0) {
            creep.heal(creep);
        }
    },

    // 治疗其他creep
    healOthers: function(creep, target) {
        if(creep.heal(target) == ERR_NOT_IN_RANGE) {
            creep.moveTo(target, {
                visualizePathStyle: {stroke: '#00ff00'},
                maxRooms: 1,
                reusePath: 5
            });
        }
    },

    // 优化的巡逻逻辑
    patrol: function(creep) {
        // 初始化巡逻点
        if(!creep.memory.patrolPoints) {
            const spawn = creep.room.find(FIND_MY_SPAWNS)[0];
            if(spawn) {
                // 创建更多的巡逻点，形成一个保护圈
                creep.memory.patrolPoints = [
                    {x: spawn.pos.x - 5, y: spawn.pos.y - 5},
                    {x: spawn.pos.x + 5, y: spawn.pos.y - 5},
                    {x: spawn.pos.x + 5, y: spawn.pos.y + 5},
                    {x: spawn.pos.x - 5, y: spawn.pos.y + 5},
                    {x: spawn.pos.x, y: spawn.pos.y - 7},
                    {x: spawn.pos.x, y: spawn.pos.y + 7}
                ];
                creep.memory.patrolIndex = 0;
            }
        }
        
        if(creep.memory.patrolPoints) {
            const point = creep.memory.patrolPoints[creep.memory.patrolIndex];
            
            // 到达目标点后更换下一个巡逻点
            if(creep.pos.x == point.x && creep.pos.y == point.y) {
                creep.memory.patrolIndex = (creep.memory.patrolIndex + 1) % creep.memory.patrolPoints.length;
            }
            
            // 移动到巡逻点
            creep.moveTo(point.x, point.y, {
                visualizePathStyle: {stroke: '#ffffff'},
                reusePath: 20,
                maxRooms: 1
            });
        }
    }
}; 