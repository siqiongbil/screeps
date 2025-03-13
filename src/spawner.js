const PRIORITY_LEVELS = {
    EMERGENCY: 0,    // 紧急情况（如没有采集者）
    CRITICAL: 1,     // 关键角色（如carrier）
    HIGH: 2,        // 高优先级（如upgrader）
    MEDIUM: 3,      // 中等优先级（如builder）
    LOW: 4          // 低优先级（如scout）
};

const ROLE_PRIORITIES = {
    harvester: PRIORITY_LEVELS.EMERGENCY,
    carrier: PRIORITY_LEVELS.CRITICAL,
    upgrader: PRIORITY_LEVELS.HIGH,
    builder: PRIORITY_LEVELS.MEDIUM,
    repairer: PRIORITY_LEVELS.MEDIUM,
    defender: PRIORITY_LEVELS.HIGH,
    healer: PRIORITY_LEVELS.HIGH,
    rangedAttacker: PRIORITY_LEVELS.HIGH,
    scout: PRIORITY_LEVELS.LOW
};

class SpawnManager {
    constructor() {
        if (!Memory.spawns) {
            Memory.spawns = {
                queues: {},
                stats: {}
            };
        }
    }

    run(room) {
        if (!room.controller || !room.controller.my) return;

        try {
            // 初始化房间的孵化队列
            this.initializeQueue(room);
            
            // 更新房间状态
            this.updateRoomStatus(room);
            
            // 分析需求并添加到队列
            this.analyzeAndQueueCreeps(room);
            
            // 处理孵化队列
            this.processSpawnQueue(room);
            
            // 更新统计信息
            if (Game.time % 100 === 0) {
                this.updateStats(room);
            }
        } catch (error) {
            console.log(`孵化管理器错误 ${room.name}: ${error}`);
        }
    }

    initializeQueue(room) {
        if (!Memory.spawns.queues[room.name]) {
            Memory.spawns.queues[room.name] = {
                queue: [],
                lastCheck: Game.time,
                emergencyMode: false
            };
        }
    }

    updateRoomStatus(room) {
        const spawns = room.find(FIND_MY_SPAWNS);
        const roomQueue = Memory.spawns.queues[room.name];
        
        // 检查是否处于紧急状态
        const harvesters = _.filter(Game.creeps, creep => 
            creep.memory.role === 'harvester' && creep.room.name === room.name
        );
        
        roomQueue.emergencyMode = harvesters.length < 2;
        
        // 更新可用能量
        roomQueue.availableEnergy = room.energyAvailable;
        roomQueue.energyCapacity = room.energyCapacityAvailable;
        
        // 更新spawn状态
        roomQueue.spawns = spawns.map(spawn => ({
            id: spawn.id,
            name: spawn.name,
            busy: !!spawn.spawning
        }));
    }

    analyzeAndQueueCreeps(room) {
        const roomQueue = Memory.spawns.queues[room.name];
        
        // 如果队列已满，不再分析
        if (roomQueue.queue.length >= 10) return;
        
        // 获取当前房间的creep数量
        const creepCounts = this.getCreepCounts(room);
        
        // 获取目标数量
        const targetCounts = this.getTargetCounts(room);
        
        // 分析每个角色的需求
        for (let role in targetCounts) {
            const current = creepCounts[role] || 0;
            const target = targetCounts[role];
            
            if (current < target) {
                // 计算需要添加的数量
                const needed = target - current;
                
                // 检查队列中是否已经有该角色的请求
                const inQueue = roomQueue.queue.filter(req => req.role === role).length;
                
                // 如果队列中的数量加上当前数量仍小于目标，添加新的请求
                if (current + inQueue < target) {
                    this.queueCreep(room, {
                        role: role,
                        priority: ROLE_PRIORITIES[role],
                        body: this.getOptimalBody(room, role)
                    });
                }
            }
        }
    }

    getCreepCounts(room) {
        const counts = {};
        for (let name in Game.creeps) {
            const creep = Game.creeps[name];
            if (creep.room.name === room.name) {
                counts[creep.memory.role] = (counts[creep.memory.role] || 0) + 1;
            }
        }
        return counts;
    }

    getTargetCounts(room) {
        // 基于房间等级和状态动态计算目标数量
        const rcl = room.controller.level;
        const hostiles = room.find(FIND_HOSTILE_CREEPS).length;
        const constructionSites = room.find(FIND_CONSTRUCTION_SITES).length;
        
        return {
            harvester: Math.min(rcl + 1, 4),
            carrier: rcl >= 3 ? Math.min(rcl, 4) : 0,
            upgrader: Math.min(rcl + 1, 3),
            builder: constructionSites > 0 ? Math.min(rcl, 3) : 0,
            repairer: Math.min(Math.floor(rcl/2), 2),
            defender: hostiles > 0 ? Math.min(hostiles, 3) : 0,
            healer: hostiles > 0 ? Math.floor(hostiles/2) : 0,
            rangedAttacker: hostiles > 0 ? Math.min(hostiles, 2) : 0,
            scout: rcl >= 4 ? 1 : 0
        };
    }

    getOptimalBody(room, role) {
        const energy = room.energyCapacityAvailable;
        const emergencyMode = Memory.spawns.queues[room.name].emergencyMode;
        
        // 紧急模式下使用基础配置
        if (emergencyMode) {
            return [WORK, CARRY, MOVE];
        }
        
        // 根据角色和可用能量返回最优体型
        const bodies = {
            harvester: this.getHarvesterBody(energy),
            carrier: this.getCarrierBody(energy),
            upgrader: this.getUpgraderBody(energy),
            builder: this.getBuilderBody(energy),
            repairer: this.getRepairerBody(energy),
            defender: this.getDefenderBody(energy),
            healer: this.getHealerBody(energy),
            rangedAttacker: this.getRangedAttackerBody(energy),
            scout: this.getScoutBody(energy)
        };
        
        return bodies[role] || [WORK, CARRY, MOVE];
    }

    getHarvesterBody(energy) {
        let body = [];
        let maxParts = Math.floor(energy / 200); // WORK=100, CARRY=50, MOVE=50
        maxParts = Math.min(maxParts, 6); // 限制最大部件数
        
        for (let i = 0; i < maxParts; i++) {
            body.push(WORK);
            body.push(CARRY);
            body.push(MOVE);
        }
        
        return body;
    }

    getCarrierBody(energy) {
        let body = [];
        let maxParts = Math.floor(energy / 150); // CARRY=50, CARRY=50, MOVE=50
        maxParts = Math.min(maxParts, 8);
        
        for (let i = 0; i < maxParts; i++) {
            body.push(CARRY);
            body.push(CARRY);
            body.push(MOVE);
        }
        
        return body;
    }

    getUpgraderBody(energy) {
        let body = [];
        let maxParts = Math.floor(energy / 200); // WORK=100, CARRY=50, MOVE=50
        maxParts = Math.min(maxParts, 6);
        
        for (let i = 0; i < maxParts; i++) {
            body.push(WORK);
            body.push(CARRY);
            body.push(MOVE);
        }
        
        return body;
    }

    getBuilderBody(energy) {
        let body = [];
        let maxParts = Math.floor(energy / 200);
        maxParts = Math.min(maxParts, 5);
        
        for (let i = 0; i < maxParts; i++) {
            body.push(WORK);
            body.push(CARRY);
            body.push(MOVE);
        }
        
        return body;
    }

    getRepairerBody(energy) {
        return this.getBuilderBody(energy); // 使用与建造者相同的体型
    }

    getDefenderBody(energy) {
        let body = [];
        let maxParts = Math.floor(energy / 190); // ATTACK=80, TOUGH=10, MOVE=100
        maxParts = Math.min(maxParts, 7);
        
        // 添加TOUGH
        for (let i = 0; i < Math.min(maxParts, 2); i++) {
            body.push(TOUGH);
        }
        
        // 添加ATTACK
        for (let i = 0; i < maxParts; i++) {
            body.push(ATTACK);
        }
        
        // 添加MOVE
        for (let i = 0; i < maxParts; i++) {
            body.push(MOVE);
        }
        
        return body;
    }

    getHealerBody(energy) {
        let body = [];
        let maxParts = Math.floor(energy / 300); // HEAL=250, MOVE=50
        maxParts = Math.min(maxParts, 5);
        
        for (let i = 0; i < maxParts; i++) {
            body.push(HEAL);
            body.push(MOVE);
        }
        
        return body;
    }

    getRangedAttackerBody(energy) {
        let body = [];
        let maxParts = Math.floor(energy / 200); // RANGED_ATTACK=150, MOVE=50
        maxParts = Math.min(maxParts, 6);
        
        for (let i = 0; i < maxParts; i++) {
            body.push(RANGED_ATTACK);
            body.push(MOVE);
        }
        
        return body;
    }

    getScoutBody(energy) {
        return [MOVE, MOVE, MOVE]; // 轻量级侦察兵
    }

    queueCreep(room, request) {
        const roomQueue = Memory.spawns.queues[room.name];
        
        // 创建新的请求
        const spawnRequest = {
            role: request.role,
            body: request.body,
            priority: request.priority,
            timeAdded: Game.time
        };
        
        // 将请求添加到队列并按优先级排序
        roomQueue.queue.push(spawnRequest);
        roomQueue.queue.sort((a, b) => a.priority - b.priority);
        
        // 限制队列长度
        if (roomQueue.queue.length > 20) {
            roomQueue.queue = roomQueue.queue.slice(0, 20);
        }
    }

    processSpawnQueue(room) {
        const roomQueue = Memory.spawns.queues[room.name];
        if (!roomQueue || roomQueue.queue.length === 0) return;
        
        // 获取可用的spawn
        const availableSpawn = room.find(FIND_MY_SPAWNS).find(spawn => !spawn.spawning);
        if (!availableSpawn) return;
        
        // 获取队列中的第一个请求
        const request = roomQueue.queue[0];
        
        // 检查是否有足够的能量
        const bodyCost = this.calculateBodyCost(request.body);
        if (room.energyAvailable < bodyCost) return;
        
        // 尝试孵化
        const creepName = this.generateCreepName(request.role);
        const result = availableSpawn.spawnCreep(request.body, creepName, {
            memory: {
                role: request.role,
                room: room.name,
                working: false
            }
        });
        
        // 如果孵化成功，从队列中移除请求
        if (result === OK) {
            roomQueue.queue.shift();
            console.log(`房间 ${room.name} 开始孵化 ${request.role}: ${creepName}`);
            
            // 更新统计信息
            this.recordSpawn(room, request);
        }
    }

    calculateBodyCost(body) {
        return body.reduce((cost, part) => cost + BODYPART_COST[part], 0);
    }

    generateCreepName(role) {
        return role.charAt(0).toUpperCase() + role.slice(1) + Game.time;
    }

    recordSpawn(room, request) {
        if (!Memory.spawns.stats[room.name]) {
            Memory.spawns.stats[room.name] = {
                spawns: {},
                totalSpawns: 0
            };
        }
        
        const stats = Memory.spawns.stats[room.name];
        stats.totalSpawns++;
        
        if (!stats.spawns[request.role]) {
            stats.spawns[request.role] = 0;
        }
        stats.spawns[request.role]++;
    }

    updateStats(room) {
        const stats = Memory.spawns.stats[room.name];
        if (!stats) return;
        
        console.log(`房间 ${room.name} 孵化统计:
            总孵化数: ${stats.totalSpawns}
            角色分布:
            ${Object.entries(stats.spawns)
                .map(([role, count]) => `${role}: ${count}`)
                .join('\n            ')}`);
    }
}

module.exports = new SpawnManager();