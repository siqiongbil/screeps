module.exports = {
    run: function(creep) {
        // 如果没有巡逻点，初始化巡逻点
        if(!creep.memory.patrolPoints) {
            this.initializePatrolPoints(creep);
        }

        // 检查是否发现敌人
        const hostiles = creep.room.find(FIND_HOSTILE_CREEPS);
        if(hostiles.length > 0) {
            this.handleHostiles(creep, hostiles);
            return;
        }

        // 检查是否需要更新巡逻点
        if(Game.time % 1000 === 0) {
            this.updatePatrolPoints(creep);
        }

        // 继续巡逻
        this.patrol(creep);

        // 检查房间状态
        this.checkRoomStatus(creep);
    },

    // 初始化巡逻点
    initializePatrolPoints: function(creep) {
        const room = creep.room;
        const width = room.getDimensions().width;
        const height = room.getDimensions().height;
        
        // 设置巡逻点（房间边缘，但保持一定距离）
        const margin = 3;
        creep.memory.patrolPoints = [
            {x: margin, y: margin},
            {x: margin, y: height - margin},
            {x: width - margin, y: height - margin},
            {x: width - margin, y: margin}
        ];
        creep.memory.patrolIndex = 0;
        creep.memory.lastPointUpdate = Game.time;
    },

    // 更新巡逻点
    updatePatrolPoints: function(creep) {
        const room = creep.room;
        const width = room.getDimensions().width;
        const height = room.getDimensions().height;
        
        // 随机调整巡逻点位置，但保持在边缘
        const margin = 3;
        creep.memory.patrolPoints = [
            {x: margin + Math.floor(Math.random() * 5), y: margin + Math.floor(Math.random() * 5)},
            {x: margin + Math.floor(Math.random() * 5), y: height - margin - Math.floor(Math.random() * 5)},
            {x: width - margin - Math.floor(Math.random() * 5), y: height - margin - Math.floor(Math.random() * 5)},
            {x: width - margin - Math.floor(Math.random() * 5), y: margin + Math.floor(Math.random() * 5)}
        ];
        creep.memory.lastPointUpdate = Game.time;
    },

    // 处理敌人
    handleHostiles: function(creep, hostiles) {
        // 记录敌人信息到内存
        creep.room.memory.hostiles = {
            count: hostiles.length,
            positions: hostiles.map(h => ({x: h.pos.x, y: h.pos.y})),
            time: Game.time,
            types: hostiles.map(h => h.body.map(b => b.type)),
            threatLevel: this.calculateThreatLevel(hostiles)
        };
        
        // 远离敌人
        const closest = creep.pos.findClosestByRange(hostiles);
        if(closest && creep.pos.getRangeTo(closest) < 5) {
            const fleePath = PathFinder.search(creep.pos, {
                pos: closest.pos,
                range: 5
            }, {
                flee: true,
                maxOps: 2000,
                maxCost: 50,
                heuristicWeight: 1.2
            });
            
            if(fleePath.path && fleePath.path.length > 0) {
                creep.moveByPath(fleePath.path);
            } else {
                // 如果找不到合适的逃跑路径，随机移动
                const randomDirection = Math.floor(Math.random() * 8);
                creep.move(randomDirection);
            }
        }
    },

    // 计算威胁等级
    calculateThreatLevel: function(hostiles) {
        let threat = 0;
        hostiles.forEach(hostile => {
            threat += hostile.getActiveBodyparts(ATTACK) * 2;
            threat += hostile.getActiveBodyparts(RANGED_ATTACK) * 2;
            threat += hostile.getActiveBodyparts(HEAL) * 3;
            threat += hostile.getActiveBodyparts(TOUGH);
        });
        return Math.min(5, Math.ceil(threat / 10));
    },

    // 巡逻
    patrol: function(creep) {
        const currentPoint = creep.memory.patrolPoints[creep.memory.patrolIndex];
        const range = creep.pos.getRangeTo(currentPoint.x, currentPoint.y);
        
        if(range <= 2) {
            // 到达当前巡逻点，移动到下一个
            creep.memory.patrolIndex = (creep.memory.patrolIndex + 1) % creep.memory.patrolPoints.length;
        }
        
        // 移动到当前巡逻点
        creep.moveTo(currentPoint.x, currentPoint.y, {
            visualizePathStyle: {stroke: '#ffffff'},
            reusePath: 20,
            maxOps: 2000,
            maxCost: 50,
            heuristicWeight: 1.2
        });
    },

    // 检查房间状态
    checkRoomStatus: function(creep) {
        if(!creep.room.memory.lastScout || Game.time - creep.room.memory.lastScout > 100) {
            const room = creep.room;
            
            // 更新资源信息
            creep.room.memory.resources = {
                sources: room.find(FIND_SOURCES).map(s => ({
                    id: s.id,
                    pos: s.pos,
                    energy: s.energy,
                    energyCapacity: s.energyCapacity
                })),
                minerals: room.find(FIND_MINERALS).map(m => ({
                    id: m.id,
                    pos: m.pos,
                    mineralType: m.mineralType,
                    mineralAmount: m.mineralAmount
                }))
            };

            // 更新建筑信息
            creep.room.memory.structures = {
                constructionSites: room.find(FIND_CONSTRUCTION_SITES).length,
                damagedStructures: room.find(FIND_STRUCTURES, {
                    filter: s => s.hits < s.hitsMax && s.structureType !== STRUCTURE_WALL
                }).length,
                walls: room.find(FIND_STRUCTURES, {
                    filter: s => s.structureType === STRUCTURE_WALL
                }).length
            };

            // 更新能量状态
            creep.room.memory.energyStatus = {
                energyAvailable: room.energyAvailable,
                energyCapacityAvailable: room.energyCapacityAvailable,
                storage: room.storage ? room.storage.store[RESOURCE_ENERGY] : 0,
                storageCapacity: room.storage ? room.storage.store.getCapacity(RESOURCE_ENERGY) : 0
            };

            creep.room.memory.lastScout = Game.time;
        }
    }
}; 