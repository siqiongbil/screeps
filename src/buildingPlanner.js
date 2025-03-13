const utils = require('utils');

// 建筑优先级
const STRUCTURE_PRIORITY = {
    [STRUCTURE_SPAWN]: 1,
    [STRUCTURE_TOWER]: 2,
    [STRUCTURE_RAMPART]: 3,
    [STRUCTURE_WALL]: 4,
    [STRUCTURE_EXTENSION]: 5,
    [STRUCTURE_CONTAINER]: 6,
    [STRUCTURE_STORAGE]: 7,
    [STRUCTURE_ROAD]: 8,
    [STRUCTURE_LINK]: 9,
    [STRUCTURE_TERMINAL]: 10,
    [STRUCTURE_LAB]: 11,
    [STRUCTURE_FACTORY]: 12,
    [STRUCTURE_OBSERVER]: 13,
    [STRUCTURE_NUKER]: 14
};

module.exports = {
    // 导出建筑优先级常量
    STRUCTURE_PRIORITY: STRUCTURE_PRIORITY,
    
    // 主运行函数
    run: function(room) {
        // 如果房间没有控制器或控制器不属于我们，退出
        if(!room.controller || !room.controller.my) return;
        
        // 获取建筑工地数量
        const sites = room.find(FIND_CONSTRUCTION_SITES);
        if(sites.length >= 3) return; // 限制同时存在的建筑工地数量
        
        // 获取建筑计划
        const buildingPlan = this.getBuildingPlan(room);
        
        // 创建建筑工地
        this.createConstructionSites(room, buildingPlan);
    },

    // 获取建筑计划
    getBuildingPlan: function(room) {
        const level = room.controller.level;
        const spawn = room.find(FIND_MY_SPAWNS)[0];
        if(!spawn) return [];

        let structures = [];
        const center = spawn.pos;

        // 获取防御矩阵布局
        const defenseMatrix = this.getDefenseMatrix(center, level);
        structures = structures.concat(defenseMatrix);

        // 基础布局（等级1-2）：优先防御
        if(level >= 1) {
            structures.push(
                // 能量容器围绕spawn
                {type: STRUCTURE_CONTAINER, pos: {x: center.x - 1, y: center.y}},
                {type: STRUCTURE_CONTAINER, pos: {x: center.x + 1, y: center.y}},
                // 基础防御墙
                {type: STRUCTURE_RAMPART, pos: {x: center.x, y: center.y}},  // 保护spawn
                {type: STRUCTURE_WALL, pos: {x: center.x - 2, y: center.y}},
                {type: STRUCTURE_WALL, pos: {x: center.x + 2, y: center.y}}
            );
        }

        // 扩展布局（等级3-4）
        if(level >= 3) {
            structures.push(
                // 扩展
                {type: STRUCTURE_EXTENSION, pos: {x: center.x - 2, y: center.y - 2}},
                {type: STRUCTURE_EXTENSION, pos: {x: center.x + 2, y: center.y - 2}},
                {type: STRUCTURE_EXTENSION, pos: {x: center.x - 2, y: center.y + 2}},
                {type: STRUCTURE_EXTENSION, pos: {x: center.x + 2, y: center.y + 2}},
                // 防御塔
                {type: STRUCTURE_TOWER, pos: {x: center.x, y: center.y - 2}},
                {type: STRUCTURE_TOWER, pos: {x: center.x, y: center.y + 2}},
                // 储存
                {type: STRUCTURE_STORAGE, pos: {x: center.x, y: center.y + 3}}
            );
        }

        // 高级布局（等级5-6）
        if(level >= 5) {
            structures.push(
                // 实验室
                {type: STRUCTURE_LAB, pos: {x: center.x - 3, y: center.y - 3}},
                {type: STRUCTURE_LAB, pos: {x: center.x + 3, y: center.y - 3}},
                // 连接
                {type: STRUCTURE_LINK, pos: {x: center.x - 3, y: center.y}},
                {type: STRUCTURE_LINK, pos: {x: center.x + 3, y: center.y}},
                // 额外防御塔
                {type: STRUCTURE_TOWER, pos: {x: center.x - 3, y: center.y + 3}},
                {type: STRUCTURE_TOWER, pos: {x: center.x + 3, y: center.y + 3}}
            );
        }

        // 终极布局（等级7-8）
        if(level >= 7) {
            structures.push(
                // 工厂
                {type: STRUCTURE_FACTORY, pos: {x: center.x, y: center.y + 4}},
                // 终端
                {type: STRUCTURE_TERMINAL, pos: {x: center.x - 4, y: center.y}},
                // 观察者
                {type: STRUCTURE_OBSERVER, pos: {x: center.x + 4, y: center.y}},
                // 核弹发射井
                {type: STRUCTURE_NUKER, pos: {x: center.x, y: center.y - 4}}
            );
        }

        return structures;
    },

    // 获取防御矩阵布局
    getDefenseMatrix: function(center, level) {
        let defenseStructures = [];
        
        // 基础防御圈
        const baseDefense = [
            {type: STRUCTURE_RAMPART, pos: {x: center.x, y: center.y}},
            {type: STRUCTURE_RAMPART, pos: {x: center.x-1, y: center.y}},
            {type: STRUCTURE_RAMPART, pos: {x: center.x+1, y: center.y}},
            {type: STRUCTURE_RAMPART, pos: {x: center.x, y: center.y-1}},
            {type: STRUCTURE_RAMPART, pos: {x: center.x, y: center.y+1}}
        ];
        
        defenseStructures = defenseStructures.concat(baseDefense);
        
        // 高级防御（等级3+）
        if(level >= 3) {
            const advancedDefense = [
                {type: STRUCTURE_RAMPART, pos: {x: center.x-2, y: center.y-2}},
                {type: STRUCTURE_RAMPART, pos: {x: center.x+2, y: center.y-2}},
                {type: STRUCTURE_RAMPART, pos: {x: center.x-2, y: center.y+2}},
                {type: STRUCTURE_RAMPART, pos: {x: center.x+2, y: center.y+2}}
            ];
            defenseStructures = defenseStructures.concat(advancedDefense);
        }
        
        return defenseStructures;
    },

    // 检查并创建建筑工地
    createConstructionSites: function(room, structures) {
        let created = 0;

        // 按优先级排序建筑
        structures.sort((a, b) => STRUCTURE_PRIORITY[a.type] - STRUCTURE_PRIORITY[b.type]);

        // 创建建筑工地
        for(let structure of structures) {
            // 检查是否达到建筑数量限制
            const currentCount = room.find(FIND_STRUCTURES, {
                filter: s => s.structureType === structure.type
            }).length;
            
            const limit = this.getStructureLimit(structure.type, room.controller.level);
            if(currentCount >= limit) continue;

            // 检查位置是否可以建造
            if(this.canBuildHere(room, structure.pos.x, structure.pos.y)) {
                const result = room.createConstructionSite(
                    structure.pos.x,
                    structure.pos.y,
                    structure.type
                );
                
                if(result === OK) {
                    created++;
                    console.log(`在房间 ${room.name} 创建 ${structure.type} 建筑工地`);
                    // 限制每tick创建的工地数量
                    if(created >= 3) break;
                }
            }
        }
    },

    // 获取建筑数量限制
    getStructureLimit: function(structureType, level) {
        switch(structureType) {
            case STRUCTURE_EXTENSION:
            case STRUCTURE_SPAWN:
            case STRUCTURE_TOWER:
            case STRUCTURE_STORAGE:
            case STRUCTURE_TERMINAL:
            case STRUCTURE_LAB:
            case STRUCTURE_FACTORY:
            case STRUCTURE_OBSERVER:
            case STRUCTURE_NUKER:
                return CONTROLLER_STRUCTURES[structureType][level] || 0;
            case STRUCTURE_CONTAINER:
                return 5;
            case STRUCTURE_ROAD:
                return 50;
            case STRUCTURE_WALL:
            case STRUCTURE_RAMPART:
                return 100;
            default:
                return 0;
        }
    },

    // 检查位置是否可以建造
    canBuildHere: function(room, x, y) {
        // 检查边界
        if(x < 1 || x > 48 || y < 1 || y > 48) return false;
        
        const pos = new RoomPosition(x, y, room.name);
        
        // 检查地形
        const terrain = Game.map.getRoomTerrain(room.name);
        if(terrain.get(x, y) === TERRAIN_MASK_WALL) return false;
        
        // 检查是否已有建筑或建筑工地
        const structures = pos.lookFor(LOOK_STRUCTURES);
        const sites = pos.lookFor(LOOK_CONSTRUCTION_SITES);
        
        return structures.length === 0 && sites.length === 0;
    },

    // 获取creep配置
    getCreepSetup: function(room) {
        const level = room.controller.level;
        const energyCapacity = room.energyCapacityAvailable;
        const hasHostiles = room.find(FIND_HOSTILE_CREEPS).length > 0;
        
        let setup = {
            harvester: {
                count: level < 3 ? 4 : 3,
                body: level >= 3 ? 
                    [WORK, WORK, CARRY, CARRY, MOVE, MOVE] :
                    [WORK, CARRY, MOVE]
            },
            upgrader: {
                count: level < 4 ? 2 : 3,
                body: level >= 3 ?
                    [WORK, WORK, CARRY, CARRY, MOVE, MOVE] :
                    [WORK, CARRY, MOVE]
            },
            builder: {
                count: level < 3 ? 1 : 2,
                body: level >= 3 ?
                    [WORK, WORK, CARRY, CARRY, MOVE, MOVE] :
                    [WORK, CARRY, MOVE]
            },
            repairer: {
                count: 1,
                body: level >= 3 ?
                    [WORK, WORK, CARRY, CARRY, MOVE, MOVE] :
                    [WORK, CARRY, MOVE]
            },
            defender: {
                count: hasHostiles ? 2 : 1,
                body: level >= 3 ?
                    [ATTACK, ATTACK, MOVE, MOVE, TOUGH, TOUGH] :
                    [ATTACK, MOVE, TOUGH]
            }
        };

        // 根据可用能量调整身体部件
        for(let role in setup) {
            const bodyCost = this.calculateBodyCost(setup[role].body);
            if(bodyCost > energyCapacity) {
                setup[role].body = [WORK, CARRY, MOVE];
            }
        }

        return setup;
    },

    // 计算身体部件成本
    calculateBodyCost: function(body) {
        return body.reduce((cost, part) => cost + BODYPART_COST[part], 0);
    }
}; 