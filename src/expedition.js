// const utils = require('utils');

module.exports = {
    // 运行远征系统
    run: function(room) {
        try {
            // 检查房间是否有效
            if(!room) {
                return;
            }
            
            // 检查是否是我们控制的房间
            if(!room.controller || !room.controller.my) {
                return;
            }

            // 检查房间内存是否存在
            if(!room.memory) {
                return;
            }
            
            // 初始化远征数据
            if(!room.memory.expedition) {
                this.initializeExpedition(room);
            }

            // 清理过期数据 - 每500个tick清理一次
            if(Game.time % 500 === 0) {
                this.cleanupExpeditionData(room);
            }

            // 更新远征状态 - 减少更新频率
            if(Game.time % 200 === 0) {
                this.updateExpeditionStatus(room);
            }

            // 执行远征任务 - 减少执行频率
            if(Game.time % 10 === 0) {
                this.executeExpeditionTasks(room);
            }

            // 管理远征队伍 - 减少执行频率
            if(Game.time % 50 === 0) {
                this.manageExpeditionTeams(room);
            }
        } catch(error) {
            // 减少错误日志输出频率
            if(Game.time % 100 === 0) {
                console.log(`远征系统错误 (${room ? room.name : 'unknown'}): ${error}`);
            }
        }
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
        
        // 确保 expedition 对象存在
        if (!expedition) {
            this.initializeExpedition(room);
            return;
        }
        
        // 确保 teams 数组存在
        if (!expedition.teams) {
            expedition.teams = [];
            return;
        }
        
        // 清理已解散的队伍
        expedition.teams = expedition.teams.filter(team => {
            if (!team || !team.members) {
                return false;
            }
            const creeps = team.members.map(id => Game.getObjectById(id));
            return creeps.some(c => c);
        });
        
        // 更新每个队伍的状态
        for(let team of expedition.teams) {
            if (!team || !team.members) {
                continue;
            }
            const creeps = team.members.map(id => Game.getObjectById(id));
            team.alive = creeps.filter(c => c).length;
            team.health = creeps.reduce((sum, c) => sum + (c ? c.hits / c.hitsMax : 0), 0) / (team.alive || 1); // 避免除以零
        }
    },

    // 更新任务状态
    updateMissionStatus: function(room) {
        const expedition = room.memory.expedition;
        
        // 确保 expedition 对象存在
        if (!expedition) {
            this.initializeExpedition(room);
            return;
        }
        
        // 确保 missions 数组存在
        if (!expedition.missions) {
            expedition.missions = [];
            return;
        }
        
        // 清理已完成或失败的任务
        expedition.missions = expedition.missions.filter(mission => {
            if (!mission) {
                return false;
            }
            
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
        
        // 确保 expedition 对象存在
        if (!expedition) {
            this.initializeExpedition(room);
            return;
        }
        
        // 确保 teams 数组存在
        if (!expedition.teams) {
            expedition.teams = [];
            return;
        }
        
        // 检查是否需要新任务
        if(expedition.teams.length < expedition.strategy.maxTeams) {
            this.assignNewMissions(room);
        }
        
        // 执行现有任务
        for(let team of expedition.teams) {
            if (!team) {
                continue;
            }
            this.executeTeamMission(room, team);
        }
    },

    // 分配新任务
    assignNewMissions: function(room) {
        const expedition = room.memory.expedition;
        
        // 确保 expedition 对象存在
        if (!expedition) {
            this.initializeExpedition(room);
            return;
        }
        
        // 确保 resources 对象存在
        if (!expedition.resources) {
            this.initializeExpedition(room);
            return;
        }
        
        const storage = room.storage;
        
        if(!storage) return;
        
        // 检查资源需求
        for(let resource in expedition.resources) {
            if (!expedition.resources[resource]) {
                continue;
            }
            
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
        
        // 确保 expedition 对象存在
        if (!expedition) {
            this.initializeExpedition(room);
            return;
        }
        
        // 确保 missions 数组存在
        if (!expedition.missions) {
            expedition.missions = [];
        }
        
        // 限制任务数量，防止内存溢出
        if (expedition.missions.length >= 10) {
            return; // 如果任务太多，不再创建新任务
        }
        
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
        // 减少日志输出
        if(Game.time % 100 === 0) {
            console.log(`房间 ${room.name} 创建新任务：${type}`);
        }
    },

    // 执行队伍任务
    executeTeamMission: function(room, team) {
        const expedition = room.memory.expedition;
        
        // 确保 expedition 对象存在
        if (!expedition) {
            this.initializeExpedition(room);
            return;
        }
        
        // 确保 missions 数组存在
        if (!expedition.missions) {
            expedition.missions = [];
            return;
        }
        
        // 确保 team 对象有效
        if (!team || !team.id) {
            console.log(`远征系统错误 (${room.name}): team 对象无效`);
            return;
        }
        
        const mission = expedition.missions.find(m => m && m.assignedTeam === team.id);
        
        if(!mission) {
            this.assignMissionToTeam(room, team);
            return;
        }
        
        // 确保 team.members 数组存在
        if (!team.members) {
            console.log(`远征系统错误 (${room.name}): team.members 数组不存在`);
            team.members = [];
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
        
        // 确保 lastTeamCreation 存在
        if(!expedition.lastTeamCreation) {
            expedition.lastTeamCreation = 0;
        }
        
        // 检查是否需要创建新队伍 - 限制创建频率
        if(expedition.teams.length < expedition.strategy.maxTeams && 
           Game.time - expedition.lastTeamCreation > 1000) { // 至少间隔1000个tick
            this.createNewTeam(room);
            expedition.lastTeamCreation = Game.time;
        }
        
        // 补充现有队伍
        for(let team of expedition.teams) {
            if(team && team.members) {
                this.replenishTeam(room, team);
            }
        }
    },

    // 创建新队伍
    createNewTeam: function(room) {
        const expedition = room.memory.expedition;
        
        // 限制队伍数量，防止内存溢出
        if (expedition.teams.length >= expedition.strategy.maxTeams) {
            return; // 如果队伍太多，不再创建新队伍
        }
        
        // 检查是否有足够的能量创建队伍
        if(room.energyAvailable < room.energyCapacityAvailable * 0.8) {
            return; // 能量不足，暂不创建队伍
        }
        
        const team = {
            id: Game.time,
            members: [],
            type: 'harvest', // 默认类型
            alive: 0,
            health: 1
        };
        
        // 创建队伍成员 - 限制创建数量
        const minTeamSize = Math.min(expedition.strategy.minTeamSize, 3); // 最多创建3个成员
        
        // 使用队列系统请求creep而不是直接生成
        if(!Memory.spawns) {
            Memory.spawns = {
                queues: {},
                stats: {}
            };
        }
        
        if(!Memory.spawns.queues[room.name]) {
            Memory.spawns.queues[room.name] = {
                queue: [],
                lastCheck: Game.time,
                emergencyMode: false,
                energyRequests: []
            };
        }
        
        // 添加到队列
        const creepName = `Expedition${Game.time}`;
        const body = this.getTeamCreepBody(room, team.type);
        
        // 添加到队列
        Memory.spawns.queues[room.name].energyRequests.push({
            role: 'scout', // 使用scout角色
            priority: 3, // 中等优先级
            body: body,
            memory: {
                role: 'scout',
                expedition: true,
                teamId: team.id
            }
        });
        
        // 记录队伍
        expedition.teams.push(team);
        console.log(`房间 ${room.name} 创建新远征队伍请求：${team.id}`);
    },

    // 补充队伍
    replenishTeam: function(room, team) {
        const expedition = room.memory.expedition;
        
        // 检查队伍是否需要补充
        if(team.alive < expedition.strategy.minTeamSize && team.alive > 0) {
            // 使用队列系统请求creep而不是直接生成
            if(!Memory.spawns) {
                Memory.spawns = {
                    queues: {},
                    stats: {}
                };
            }
            
            if(!Memory.spawns.queues[room.name]) {
                Memory.spawns.queues[room.name] = {
                    queue: [],
                    lastCheck: Game.time,
                    emergencyMode: false,
                    energyRequests: []
                };
            }
            
            // 添加到队列
            const body = this.getTeamCreepBody(room, team.type);
            
            // 添加到队列
            Memory.spawns.queues[room.name].energyRequests.push({
                role: 'scout', // 使用scout角色
                priority: 2, // 较高优先级
                body: body,
                memory: {
                    role: 'scout',
                    expedition: true,
                    teamId: team.id
                }
            });
            
            console.log(`房间 ${room.name} 补充远征队伍请求：${team.id}`);
        }
    },

    // 获取队伍的creep body
    getTeamCreepBody: function(room, type) {
        // 实现获取队伍的creep body的逻辑
        // 这里需要根据队伍类型和房间资源情况来决定creep的body
        // 这里只是一个示例，实际实现需要根据实际情况来决定
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
    },

    // 清理过期的远征数据
    cleanupExpeditionData: function(room) {
        const expedition = room.memory.expedition;
        
        if(!expedition) return;
        
        // 清理过期的队伍（超过2000tick没有活跃成员的队伍）
        if(expedition.teams && expedition.teams.length > 0) {
            const currentTime = Game.time;
            expedition.teams = expedition.teams.filter(team => {
                if(!team) return false;
                
                // 检查队伍是否有活跃成员
                const hasActiveMembers = team.members && team.members.some(id => Game.creeps[id]);
                
                // 如果没有活跃成员且队伍已经存在超过2000tick，则移除
                if(!hasActiveMembers && currentTime - team.id > 2000) {
                    return false;
                }
                
                return true;
            });
        }
        
        // 清理过期的任务（超过5000tick的任务）
        if(expedition.missions && expedition.missions.length > 0) {
            const currentTime = Game.time;
            expedition.missions = expedition.missions.filter(mission => {
                if(!mission) return false;
                
                // 如果任务已经存在超过5000tick，则移除
                if(currentTime - mission.startTime > 5000) {
                    return false;
                }
                
                return true;
            });
        }
        
        // 限制异常数量
        if(expedition.anomalies && expedition.anomalies.length > 10) {
            expedition.anomalies = expedition.anomalies.slice(-10);
        }
    }
};