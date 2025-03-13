const utils = require('utils');

module.exports = {
    // 主运行函数
    run: function(room) {
        // 每tick都需要检查防御
        const hostiles = room.find(FIND_HOSTILE_CREEPS);
        if(hostiles.length === 0) {
            this.peacetimeOperations(room);
            return;
        }
        
        // 分析威胁
        const threats = this.analyzeThreat(hostiles);
        room.memory.threatLevel = threats.threatLevel;
        
        // 执行战斗操作
        this.executeCombatOperations(room, threats);
    },

    // 分析威胁
    analyzeThreat: function(hostiles) {
        let threatLevel = 0;
        let healers = [];
        let attackers = [];
        let rangedAttackers = [];
        
        hostiles.forEach(creep => {
            const healParts = creep.getActiveBodyparts(HEAL);
            const attackParts = creep.getActiveBodyparts(ATTACK);
            const rangedParts = creep.getActiveBodyparts(RANGED_ATTACK);
            const toughParts = creep.getActiveBodyparts(TOUGH);
            
            if(healParts > 0) {
                healers.push({
                    creep: creep,
                    healPower: healParts * 12
                });
                threatLevel += healParts * 3;
            }
            
            if(attackParts > 0) {
                attackers.push({
                    creep: creep,
                    attackPower: attackParts * 30
                });
                threatLevel += attackParts * 2;
            }
            
            if(rangedParts > 0) {
                rangedAttackers.push({
                    creep: creep,
                    rangedPower: rangedParts * 10
                });
                threatLevel += rangedParts * 2;
            }
            
            threatLevel += toughParts;
        });
        
        return {
            threatLevel: Math.min(5, Math.ceil(threatLevel / 10)),
            healers,
            attackers,
            rangedAttackers,
            totalHostiles: hostiles.length
        };
    },

    // 执行战斗操作
    executeCombatOperations: function(room, threats) {
        // 检查是否需要激活安全模式
        this.checkSafeMode(room, threats.threatLevel);
        
        // 控制防御塔
        this.operateTowers(room, threats);
        
        // 调整creep角色
        this.adjustCreepRoles(room, threats);
        
        // 发送求援信号（如果需要）
        if(threats.threatLevel >= 4) {
            this.requestReinforcements(room);
        }
    },

    // 和平时期操作
    peacetimeOperations: function(room) {
        // 检查能量紧急状态
        const emergency = utils.checkEnergyEmergency(room);
        if(emergency.isEmergency) {
            this.handleEnergyEmergency(room, emergency);
        }
        
        // 维修建筑
        this.repairStructures(room);
    },

    // 检查是否需要激活安全模式
    checkSafeMode: function(room, threatLevel) {
        if(!room.controller.safeMode && threatLevel >= 4) {
            const cost = CONTROLLER_SAFEMODE_COST;
            if(room.controller.activateSafeMode() === OK) {
                console.log(`房间 ${room.name} 激活了安全模式`);
            }
        }
    },

    // 控制防御塔
    operateTowers: function(room, threats) {
        const towers = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_TOWER
        });
        
        if(towers.length === 0) return;
        
        // 计算总伤害
        const totalTowerDamage = towers.length * 600;
        
        // 选择优先目标
        let primaryTarget = this.selectPrimaryTarget(threats);
        
        // 如果找到目标，所有塔集中火力
        if(primaryTarget) {
            towers.forEach(tower => {
                if(tower.store[RESOURCE_ENERGY] >= 10) {
                    tower.attack(primaryTarget);
                }
            });
        }
    },

    // 选择优先攻击目标
    selectPrimaryTarget: function(threats) {
        // 优先攻击治疗者
        if(threats.healers.length > 0) {
            return threats.healers.sort((a, b) => b.healPower - a.healPower)[0].creep;
        }
        // 其次攻击近战单位
        if(threats.attackers.length > 0) {
            return threats.attackers.sort((a, b) => b.attackPower - a.attackPower)[0].creep;
        }
        // 最后是远程单位
        if(threats.rangedAttackers.length > 0) {
            return threats.rangedAttackers.sort((a, b) => b.rangedPower - a.rangedPower)[0].creep;
        }
        return null;
    },

    // 调整creep角色
    adjustCreepRoles: function(room, threats) {
        const requiredDefenders = Math.min(threats.threatLevel * 2, 6);
        const requiredHealers = Math.min(threats.threatLevel, 3);
        const requiredRanged = Math.min(threats.threatLevel * 2, 4);
        
        this.requestDefenseCreeps(room, {
            defenders: requiredDefenders,
            healers: requiredHealers,
            ranged: requiredRanged
        });
    },

    // 请求防御creep
    requestDefenseCreeps: function(room, requirements) {
        const spawn = room.find(FIND_MY_SPAWNS)[0];
        if(!spawn || spawn.spawning) return;
        
        const defenders = _.filter(Game.creeps, c => c.memory.role === 'defender' && c.room.name === room.name);
        const healers = _.filter(Game.creeps, c => c.memory.role === 'healer' && c.room.name === room.name);
        const ranged = _.filter(Game.creeps, c => c.memory.role === 'rangedAttacker' && c.room.name === room.name);
        
        if(defenders.length < requirements.defenders) {
            this.spawnDefender(spawn, room.energyAvailable);
        }
        else if(healers.length < requirements.healers) {
            this.spawnHealer(spawn, room.energyAvailable);
        }
        else if(ranged.length < requirements.ranged) {
            this.spawnRangedAttacker(spawn, room.energyAvailable);
        }
    },

    // 生成防御者
    spawnDefender: function(spawn, energy) {
        const name = 'Defender' + Game.time;
        const body = this.getDefenderBody(energy);
        spawn.spawnCreep(body, name, {
            memory: {role: 'defender', working: false}
        });
    },

    // 生成治疗者
    spawnHealer: function(spawn, energy) {
        const name = 'Healer' + Game.time;
        const body = this.getHealerBody(energy);
        spawn.spawnCreep(body, name, {
            memory: {role: 'healer', working: false}
        });
    },

    // 生成远程攻击者
    spawnRangedAttacker: function(spawn, energy) {
        const name = 'RangedAttacker' + Game.time;
        const body = this.getRangedAttackerBody(energy);
        spawn.spawnCreep(body, name, {
            memory: {role: 'rangedAttacker', working: false}
        });
    },

    // 获取防御者身体部件
    getDefenderBody: function(energy) {
        if(energy >= 800) {
            return [TOUGH, TOUGH, MOVE, MOVE, ATTACK, ATTACK, RANGED_ATTACK, HEAL];
        }
        if(energy >= 550) {
            return [TOUGH, MOVE, MOVE, ATTACK, ATTACK, RANGED_ATTACK];
        }
        return [TOUGH, MOVE, ATTACK];
    },

    // 获取治疗者身体部件
    getHealerBody: function(energy) {
        if(energy >= 800) {
            return [TOUGH, MOVE, MOVE, MOVE, HEAL, HEAL, HEAL];
        }
        if(energy >= 550) {
            return [TOUGH, MOVE, MOVE, HEAL, HEAL];
        }
        return [MOVE, HEAL];
    },

    // 获取远程攻击者身体部件
    getRangedAttackerBody: function(energy) {
        if(energy >= 800) {
            return [TOUGH, MOVE, MOVE, MOVE, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK];
        }
        if(energy >= 550) {
            return [TOUGH, MOVE, MOVE, RANGED_ATTACK, RANGED_ATTACK];
        }
        return [MOVE, RANGED_ATTACK];
    },

    // 处理能量紧急状态
    handleEnergyEmergency: function(room, emergency) {
        console.log(`房间 ${room.name} 进入能量紧急状态: ${emergency.reason}`);
        
        // 暂停非必要的creep生成
        if(emergency.level >= 2) {
            room.memory.pauseSpawning = true;
        }
        
        // 调整防御塔能量使用
        const towers = room.find(FIND_MY_STRUCTURES, {
            filter: {structureType: STRUCTURE_TOWER}
        });
        towers.forEach(tower => {
            tower.memory.emergencyMode = true;
        });
    },

    // 维修建筑
    repairStructures: function(room) {
        const towers = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_TOWER
        });
        
        towers.forEach(tower => {
            if(tower.store[RESOURCE_ENERGY] > tower.store.getCapacity(RESOURCE_ENERGY) * 0.7) {
                const target = this.findRepairTarget(room);
                if(target) {
                    tower.repair(target);
                }
            }
        });
    },

    // 寻找需要维修的建筑
    findRepairTarget: function(room) {
        return room.find(FIND_STRUCTURES, {
            filter: structure => {
                if(structure.structureType === STRUCTURE_WALL || 
                   structure.structureType === STRUCTURE_RAMPART) {
                    return structure.hits < 10000;
                }
                return structure.hits < structure.hitsMax &&
                       structure.hits < 10000;
            }
        })[0];
    },

    // 获取战斗状态
    getBattleStatus: function(room) {
        const hostiles = room.find(FIND_HOSTILE_CREEPS);
        const threats = this.analyzeThreat(hostiles);
        const towers = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_TOWER
        });
        const walls = room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_WALL || s.structureType === STRUCTURE_RAMPART
        });
        
        return {
            hostileCount: threats.totalHostiles,
            healerCount: threats.healers.length,
            attackerCount: threats.attackers.length,
            rangedCount: threats.rangedAttackers.length,
            threatLevel: threats.threatLevel,
            towerCount: towers.length,
            towerEnergy: towers.reduce((sum, tower) => sum + tower.store[RESOURCE_ENERGY], 0),
            wallCount: walls.length,
            averageWallHits: walls.reduce((sum, wall) => sum + wall.hits, 0) / (walls.length || 1),
            safeMode: room.controller ? {
                active: room.controller.safeMode || 0,
                available: room.controller.safeModeAvailable || 0
            } : null
        };
    }
}; 