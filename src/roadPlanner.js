// const utils = require('utils');

module.exports = {
    // 主运行函数
    run: function(room) {
        // 每100 ticks执行一次规划
        if(Game.time % 100 !== 0) return;

        // 初始化内存
        if(!room.memory.roadPlanner) {
            this.initializeMemory(room);
        }

        try {
            // 更新交通流量数据
            this.updateTrafficData(room);

            // 分析主要路径
            this.analyzePaths(room);

            // 规划道路
            this.planRoads(room);

            // 创建道路建筑工地
            this.createRoadConstructionSites(room);
        } catch(error) {
            console.log(`房间 ${room.name} 道路规划错误：${error}`);
        }
    },

    // 初始化内存
    initializeMemory: function(room) {
        room.memory.roadPlanner = {
            traffic: {},      // 交通流量数据
            paths: {},        // 主要路径
            roadPlan: {},     // 道路规划
            lastUpdate: Game.time
        };
    },

    // 更新交通流量数据
    updateTrafficData: function(room) {
        const traffic = room.memory.roadPlanner.traffic;
        
        // 获取所有creep的位置
        room.find(FIND_MY_CREEPS).forEach(creep => {
            const posKey = `${creep.pos.x},${creep.pos.y}`;
            traffic[posKey] = (traffic[posKey] || 0) + 1;
        });

        // 定期清理旧数据（每1000 ticks）
        if(Game.time % 1000 === 0) {
            for(let key in traffic) {
                traffic[key] = Math.floor(traffic[key] * 0.5); // 衰减旧数据
            }
        }
    },

    // 分析主要路径
    analyzePaths: function(room) {
        const paths = room.memory.roadPlanner.paths;
        const spawn = room.find(FIND_MY_SPAWNS)[0];
        if(!spawn) return;

        // 获取重要目标点
        const targets = this.getImportantTargets(room);

        // 计算从spawn到每个目标的路径
        targets.forEach(target => {
            const path = room.findPath(spawn.pos, target.pos, {
                ignoreCreeps: true,
                ignoreRoads: true,
                swampCost: 2,
                plainCost: 1
            });

            if(path.length > 0) {
                const pathKey = `${spawn.pos.x},${spawn.pos.y}-${target.pos.x},${target.pos.y}`;
                paths[pathKey] = {
                    path: path,
                    usage: target.priority,
                    lastUpdate: Game.time
                };
            }
        });
    },

    // 获取重要目标点
    getImportantTargets: function(room) {
        const targets = [];

        // 能量源（最高优先级）
        room.find(FIND_SOURCES).forEach(source => {
            targets.push({pos: source.pos, priority: 5});
        });

        // 控制器
        if(room.controller) {
            targets.push({pos: room.controller.pos, priority: 4});
        }

        // 矿物
        room.find(FIND_MINERALS).forEach(mineral => {
            targets.push({pos: mineral.pos, priority: 3});
        });

        // 存储设施
        room.find(FIND_STRUCTURES).forEach(structure => {
            if(structure.structureType === STRUCTURE_STORAGE ||
               structure.structureType === STRUCTURE_TERMINAL ||
               structure.structureType === STRUCTURE_CONTAINER) {
                targets.push({pos: structure.pos, priority: 4});
            }
        });

        return targets;
    },

    // 规划道路
    planRoads: function(room) {
        const roadPlan = room.memory.roadPlanner.roadPlan;
        const paths = room.memory.roadPlanner.paths;
        const traffic = room.memory.roadPlanner.traffic;

        // 清除旧的规划
        for(let pos in roadPlan) {
            if(Game.time - roadPlan[pos].lastUpdate > 1000) {
                delete roadPlan[pos];
            }
        }

        // 根据路径和交通流量规划道路
        for(let pathKey in paths) {
            const pathData = paths[pathKey];
            pathData.path.forEach(step => {
                const posKey = `${step.x},${step.y}`;
                const trafficCount = traffic[posKey] || 0;

                // 根据交通流量和路径优先级决定是否建造道路
                if(trafficCount > 10 || pathData.usage >= 4) {
                    roadPlan[posKey] = {
                        x: step.x,
                        y: step.y,
                        priority: Math.min(5, Math.floor(trafficCount / 10) + pathData.usage),
                        lastUpdate: Game.time
                    };
                }
            });
        }
    },

    // 创建道路建筑工地
    createRoadConstructionSites: function(room) {
        const roadPlan = room.memory.roadPlanner.roadPlan;
        const existingRoads = new Set();

        // 获取现有道路位置
        room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_ROAD
        }).forEach(road => {
            existingRoads.add(`${road.pos.x},${road.pos.y}`);
        });

        // 获取现有建筑工地位置
        room.find(FIND_CONSTRUCTION_SITES, {
            filter: s => s.structureType === STRUCTURE_ROAD
        }).forEach(site => {
            existingRoads.add(`${site.pos.x},${site.pos.y}`);
        });

        // 按优先级排序道路计划
        const sortedPlans = Object.values(roadPlan).sort((a, b) => b.priority - a.priority);

        // 创建新的道路建筑工地（每次最多创建5个）
        let created = 0;
        for(let plan of sortedPlans) {
            const posKey = `${plan.x},${plan.y}`;
            if(!existingRoads.has(posKey) && this.canBuildRoad(room, plan.x, plan.y)) {
                const result = room.createConstructionSite(plan.x, plan.y, STRUCTURE_ROAD);
                if(result === OK) {
                    created++;
                    if(created >= 5) break;
                }
            }
        }
    },

    // 检查是否可以在指定位置建造道路
    canBuildRoad: function(room, x, y) {
        // 检查边界
        if(x < 1 || x > 48 || y < 1 || y > 48) return false;

        // 检查地形
        const terrain = Game.map.getRoomTerrain(room.name);
        if(terrain.get(x, y) === TERRAIN_MASK_WALL) return false;

        // 检查是否有其他建筑（除了道路）
        const structures = room.lookForAt(LOOK_STRUCTURES, x, y);
        return !structures.some(s => s.structureType !== STRUCTURE_ROAD);
    },

    // 获取道路状态报告
    getRoadReport: function(room) {
        const roads = room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_ROAD
        });

        const report = {
            total: roads.length,
            damaged: 0,
            criticallyDamaged: 0,
            averageHealth: 0,
            maintenanceCost: 0
        };

        roads.forEach(road => {
            const healthPercent = road.hits / road.hitsMax * 100;
            report.averageHealth += healthPercent;
            
            if(healthPercent < 50) report.criticallyDamaged++;
            else if(healthPercent < 80) report.damaged++;

            // 估算维护成本
            report.maintenanceCost += (road.hitsMax - road.hits) / 100;
        });

        if(roads.length > 0) {
            report.averageHealth /= roads.length;
        }

        return report;
    }
}; 