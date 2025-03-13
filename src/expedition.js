const utils = require('utils');

module.exports = {
    // 运行远征系统
    run: function(room) {
        // 初始化远征数据
        if(!room.memory.expedition) {
            this.initializeExpedition(room);
        }

        // 更新远征状态
        if(Game.time % 100 === 0) {
            this.updateExpeditionStatus(room);
        }

        // 执行远征任务
        this.executeExpeditionTasks(room);

        // 管理远征队伍
        this.manageExpeditionTeams(room);
    },

    // 初始化远征数据
    initializeExpedition: function(room) {
        room.memory.expedition = {
            lastUpdate: Game.time,
            teams: [],
            missions: [],
            resources: {
                energy: {min: 10000, max: 50000},
                mineral: {min: 5000, max: 20000},
                power: {min: 1000, max: 5000}
            },
            strategy: {
                maxTeams: 3,
                minTeamSize: 3,
                maxTeamSize: 8,
                safeDistance: 5,
                retreatHealth: 0.5
            }
        };
    },

    // 更新远征状态
    updateExpeditionStatus: function(room) {
        const expedition = room.memory.expedition;
        
        // 更新队伍状态
        this.updateTeamStatus(room);
        
        // 更新任务状态
        this.updateMissionStatus(room);
        
        expedition.lastUpdate = Game.time;
    },

    // 更新队伍状态
    updateTeamStatus: function(room) {
        const expedition = room.memory.expedition;
        
        // 清理已解散的队伍
        expedition.teams = expedition.teams.filter(team => {
            const creeps = team.members.map(id => Game.getObjectById(id));
            return creeps.some(c => c);
        });
        
        // 更新每个队伍的状态
        for(let team of expedition.teams) {
            const creeps = team.members.map(id => Game.getObjectById(id));
            team.alive = creeps.filter(c => c).length;
            team.health = creeps.reduce((sum, c) => sum + (c ? c.hits / c.hitsMax : 0), 0) / team.alive;
        }
    },

    // 更新任务状态
    updateMissionStatus: function(room) {
        const expedition = room.memory.expedition;
        
        // 清理已完成或失败的任务
        expedition.missions = expedition.missions.filter(mission => {
            if(mission.status === 'completed' || mission.status === 'failed') {
                return false;
            }
            
            // 检查任务目标是否还存在
            if(mission.type === 'harvest') {
                const source = Game.getObjectById(mission.target);
                return source && source.energy > 0;
            }
            else if(mission.type === 'attack') {
                const target = Game.getObjectById(mission.target);
                return target && target.hits > 0;
            }
            
            return true;
        });
    },

    // 执行远征任务
    executeExpeditionTasks: function(room) {
        const expedition = room.memory.expedition;
        
        // 检查是否需要新任务
        if(expedition.teams.length < expedition.strategy.maxTeams) {
            this.assignNewMissions(room);
        }
        
        // 执行现有任务
        for(let team of expedition.teams) {
            this.executeTeamMission(room, team);
        }
    },

    // 分配新任务
    assignNewMissions: function(room) {
        const expedition = room.memory.expedition;
        const storage = room.storage;
        
        if(!storage) return;
        
        // 检查资源需求
        for(let resource in expedition.resources) {
            const amount = storage.store[resource] || 0;
            const minAmount = expedition.resources[resource].min;
            
            if(amount < minAmount) {
                // 寻找合适的资源点
                const source = this.findResourceSource(room, resource);
                if(source) {
                    this.createMission(room, 'harvest', source.id, resource);
                }
            }
        }
        
        // 检查是否需要攻击任务
        const hostiles = this.findHostileTargets(room);
        if(hostiles.length > 0) {
            for(let hostile of hostiles) {
                this.createMission(room, 'attack', hostile.id);
            }
        }
    },

    // 创建任务
    createMission: function(room, type, target, resource = null) {
        const expedition = room.memory.expedition;
        
        const mission = {
            id: Game.time,
            type: type,
            target: target,
            resource: resource,
            status: 'pending',
            assignedTeam: null,
            startTime: Game.time
        };
        
        expedition.missions.push(mission);
        console.log(`房间 ${room.name} 创建新任务：${type} ${target}`);
    },

    // 执行队伍任务
    executeTeamMission: function(room, team) {
        const expedition = room.memory.expedition;
        const mission = expedition.missions.find(m => m.assignedTeam === team.id);
        
        if(!mission) {
            this.assignMissionToTeam(room, team);
            return;
        }
        
        const creeps = team.members.map(id => Game.getObjectById(id));
        if(creeps.length < expedition.strategy.minTeamSize) {
            this.retreatTeam(room, team);
            return;
        }
        
        // 根据任务类型执行不同的行动
        switch(mission.type) {
            case 'harvest':
                this.executeHarvestMission(room, team, mission);
                break;
            case 'attack':
                this.executeAttackMission(room, team, mission);
                break;
        }
    },

    // 执行采集任务
    executeHarvestMission: function(room, team, mission) {
        const expedition = room.memory.expedition;
        const target = Game.getObjectById(mission.target);
        
        if(!target) {
            mission.status = 'failed';
            return;
        }
        
        const creeps = team.members.map(id => Game.getObjectById(id));
        
        // 分配角色
        const miners = creeps.filter(c => c.getActiveBodyparts(WORK) > 0);
        const carriers = creeps.filter(c => c.getActiveBodyparts(CARRY) > 0);
        
        // 矿工采集
        for(let miner of miners) {
            if(miner.harvest(target) === ERR_NOT_IN_RANGE) {
                miner.moveTo(target, {visualizePathStyle: {stroke: '#ffaa00'}});
            }
        }
        
        // 运输者搬运
        for(let carrier of carriers) {
            if(carrier.store.getFreeCapacity() > 0) {
                if(carrier.pickup(target) === ERR_NOT_IN_RANGE) {
                    carrier.moveTo(target, {visualizePathStyle: {stroke: '#ffffff'}});
                }
            } else {
                if(carrier.transfer(room.storage, mission.resource) === ERR_NOT_IN_RANGE) {
                    carrier.moveTo(room.storage, {visualizePathStyle: {stroke: '#ffffff'}});
                }
            }
        }
        
        // 检查任务完成情况
        if(room.storage.store[mission.resource] >= expedition.resources[mission.resource].max) {
            mission.status = 'completed';
        }
    },

    // 执行攻击任务
    executeAttackMission: function(room, team, mission) {
        const expedition = room.memory.expedition;
        const target = Game.getObjectById(mission.target);
        
        if(!target) {
            mission.status = 'failed';
            return;
        }
        
        const creeps = team.members.map(id => Game.getObjectById(id));
        
        // 分配角色
        const attackers = creeps.filter(c => c.getActiveBodyparts(ATTACK) > 0);
        const rangedAttackers = creeps.filter(c => c.getActiveBodyparts(RANGED_ATTACK) > 0);
        const healers = creeps.filter(c => c.getActiveBodyparts(HEAL) > 0);
        
        // 远程攻击者攻击
        for(let attacker of rangedAttackers) {
            if(attacker.rangedAttack(target) === ERR_NOT_IN_RANGE) {
                attacker.moveTo(target, {visualizePathStyle: {stroke: '#ff0000'}});
            }
        }
        
        // 近战攻击者攻击
        for(let attacker of attackers) {
            if(attacker.attack(target) === ERR_NOT_IN_RANGE) {
                attacker.moveTo(target, {visualizePathStyle: {stroke: '#ff0000'}});
            }
        }
        
        // 治疗者治疗
        for(let healer of healers) {
            const damagedCreep = creeps.find(c => c.hits < c.hitsMax);
            if(damagedCreep) {
                if(healer.heal(damagedCreep) === ERR_NOT_IN_RANGE) {
                    healer.moveTo(damagedCreep, {visualizePathStyle: {stroke: '#00ff00'}});
                }
            }
        }
        
        // 检查任务完成情况
        if(target.hits <= 0) {
            mission.status = 'completed';
        }
        
        // 检查是否需要撤退
        if(team.health < expedition.strategy.retreatHealth) {
            this.retreatTeam(room, team);
        }
    },

    // 分配任务给队伍
    assignMissionToTeam: function(room, team) {
        const expedition = room.memory.expedition;
        const pendingMissions = expedition.missions.filter(m => m.status === 'pending');
        
        if(pendingMissions.length === 0) return;
        
        // 根据队伍能力选择任务
        const mission = pendingMissions[0];
        mission.assignedTeam = team.id;
        mission.status = 'in_progress';
        
        console.log(`房间 ${room.name} 队伍 ${team.id} 接受任务：${mission.type}`);
    },

    // 撤退队伍
    retreatTeam: function(room, team) {
        const expedition = room.memory.expedition;
        const creeps = team.members.map(id => Game.getObjectById(id));
        
        // 取消当前任务
        const mission = expedition.missions.find(m => m.assignedTeam === team.id);
        if(mission) {
            mission.status = 'failed';
            mission.assignedTeam = null;
        }
        
        // 让所有creep返回房间
        for(let creep of creeps) {
            if(creep) {
                creep.moveTo(room.controller, {visualizePathStyle: {stroke: '#ff0000'}});
            }
        }
        
        // 从队伍列表中移除
        expedition.teams = expedition.teams.filter(t => t.id !== team.id);
    },

    // 寻找资源源
    findResourceSource: function(room, resourceType) {
        // 在相邻房间中寻找资源
        const exits = Game.map.describeExits(room.name);
        for(let direction in exits) {
            const targetRoom = Game.rooms[exits[direction]];
            if(targetRoom) {
                if(resourceType === RESOURCE_ENERGY) {
                    const sources = targetRoom.find(FIND_SOURCES);
                    if(sources.length > 0) {
                        return sources[0];
                    }
                } else {
                    const minerals = targetRoom.find(FIND_MINERALS);
                    if(minerals.length > 0 && minerals[0].mineralType === resourceType) {
                        return minerals[0];
                    }
                }
            }
        }
        return null;
    },

    // 寻找敌对目标
    findHostileTargets: function(room) {
        const hostiles = [];
        const exits = Game.map.describeExits(room.name);
        
        for(let direction in exits) {
            const targetRoom = Game.rooms[exits[direction]];
            if(targetRoom) {
                const structures = targetRoom.find(FIND_HOSTILE_STRUCTURES);
                const creeps = targetRoom.find(FIND_HOSTILE_CREEPS);
                hostiles.push(...structures, ...creeps);
            }
        }
        
        return hostiles;
    },

    // 管理远征队伍
    manageExpeditionTeams: function(room) {
        const expedition = room.memory.expedition;
        const spawn = room.find(FIND_MY_SPAWNS)[0];
        
        if(!spawn) return;
        
        // 检查是否需要创建新队伍
        if(expedition.teams.length < expedition.strategy.maxTeams) {
            this.createNewTeam(room);
        }
        
        // 补充现有队伍
        for(let team of expedition.teams) {
            this.replenishTeam(room, team);
        }
    },

    // 创建新队伍
    createNewTeam: function(room) {
        const expedition = room.memory.expedition;
        const spawn = room.find(FIND_MY_SPAWNS)[0];
        
        if(!spawn) return;
        
        const team = {
            id: Game.time,
            members: [],
            type: 'harvest', // 默认类型
            alive: 0,
            health: 1
        };
        
        // 创建队伍成员
        for(let i = 0; i < expedition.strategy.minTeamSize; i++) {
            const creepName = `Expedition${Game.time}${i}`;
            const body = this.getTeamCreepBody(room, team.type);
            
            if(spawn.spawnCreep(body, creepName) === OK) {
                team.members.push(creepName);
            }
        }
        
        expedition.teams.push(team);
        console.log(`房间 ${room.name} 创建新远征队伍：${team.id}`);
    },

    // 补充队伍
    replenishTeam: function(room, team) {
        const expedition = room.memory.expedition;
        const spawn = room.find(FIND_MY_SPAWNS)[0];
        
        if(!spawn) return;
        
        // 检查是否需要补充
        if(team.alive < expedition.strategy.minTeamSize) {
            const creepName = `Expedition${team.id}${Game.time}`;
            const body = this.getTeamCreepBody(room, team.type);
            
            if(spawn.spawnCreep(body, creepName) === OK) {
                team.members.push(creepName);
                console.log(`房间 ${room.name} 补充远征队伍 ${team.id} 成员：${creepName}`);
            }
        }
    },

    // 获取队伍creep的身体配置
    getTeamCreepBody: function(room, type) {
        const energyCapacity = room.energyCapacityAvailable;
        
        if(type === 'harvest') {
            return [WORK, WORK, CARRY, CARRY, MOVE, MOVE];
        }
        else if(type === 'attack') {
            return [TOUGH, TOUGH, ATTACK, ATTACK, MOVE, MOVE];
        }
        else {
            return [WORK, CARRY, MOVE];
        }
    },

    // 获取远征统计信息
    getExpeditionStats: function(room) {
        const expedition = room.memory.expedition;
        
        return {
            teams: expedition.teams.length,
            missions: expedition.missions.length,
            activeMissions: expedition.missions.filter(m => m.status === 'in_progress').length,
            completedMissions: expedition.missions.filter(m => m.status === 'completed').length,
            failedMissions: expedition.missions.filter(m => m.status === 'failed').length,
            lastUpdate: expedition.lastUpdate
        };
    }
}; 