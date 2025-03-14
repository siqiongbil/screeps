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
    [STRUCTURE_EXTRACTOR]: 12,
    [STRUCTURE_FACTORY]: 13,
    [STRUCTURE_OBSERVER]: 14,
    [STRUCTURE_NUKER]: 15
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

        // 扩展布局（等级2-4）
        if(level >= 2) {
            // 等级2：最多5个扩展
            const extensions = [];
            
            // 在spawn周围添加扩展
            for(let dx = -2; dx <= 2; dx += 2) {
                for(let dy = -2; dy <= 2; dy += 2) {
                    if(dx !== 0 || dy !== 0) { // 避开spawn位置
                        extensions.push({type: STRUCTURE_EXTENSION, pos: {x: center.x + dx, y: center.y + dy}});
                    }
                }
            }
            
            // 等级3-4：更多扩展
            if(level >= 3) {
                // 添加更多扩展（等级3：最多10个，等级4：最多20个）
                for(let dx = -3; dx <= 3; dx++) {
                    for(let dy = -3; dy <= 3; dy++) {
                        // 避开已有建筑和中心区域
                        if(Math.abs(dx) > 1 || Math.abs(dy) > 1) {
                            if((Math.abs(dx) + Math.abs(dy)) <= 5) { // 限制在一定范围内
                                extensions.push({type: STRUCTURE_EXTENSION, pos: {x: center.x + dx, y: center.y + dy}});
                            }
                        }
                    }
                }
            }
            
            structures = structures.concat(extensions);
            
            // 防御塔
            if(level >= 3) {
                structures.push(
                    {type: STRUCTURE_TOWER, pos: {x: center.x, y: center.y - 2}},
                    {type: STRUCTURE_TOWER, pos: {x: center.x, y: center.y + 2}}
                );
            }
            
            // 储存
            if(level >= 4) {
                structures.push(
                    {type: STRUCTURE_STORAGE, pos: {x: center.x, y: center.y + 3}}
                );
            }
        }

        // 高级布局（等级5-6）
        if(level >= 5) {
            // 等级5-6：更多扩展（等级5：最多30个，等级6：最多40个）
            for(let dx = -4; dx <= 4; dx++) {
                for(let dy = -4; dy <= 4; dy++) {
                    // 避开已有建筑和中心区域
                    if(Math.abs(dx) > 2 || Math.abs(dy) > 2) {
                        if((Math.abs(dx) + Math.abs(dy)) <= 7) { // 限制在一定范围内
                            structures.push({type: STRUCTURE_EXTENSION, pos: {x: center.x + dx, y: center.y + dy}});
                        }
                    }
                }
            }
            
            // 等级6：实验室布局（最多3个）
            if(level >= 6) {
                // 创建实验室三角形布局，确保它们之间的距离在2格以内
                const labPositions = [
                    {x: center.x - 2, y: center.y - 2}, // 左上
                    {x: center.x, y: center.y - 2},     // 中上
                    {x: center.x - 1, y: center.y - 4}  // 上方
                ];
                
                // 添加实验室
                for(let i = 0; i < Math.min(3, CONTROLLER_STRUCTURES[STRUCTURE_LAB][level]); i++) {
                    structures.push({
                        type: STRUCTURE_LAB,
                        pos: labPositions[i]
                    });
                }
            }
            
            // 链接网络 - 等级5：最多2个链接
            const linkPositions = [];
            
            // 控制器链接 - 接收能量
            linkPositions.push({
                x: room.controller.pos.x + 2,
                y: room.controller.pos.y,
                type: 'receiver',
                priority: 1
            });
            
            // 中央链接 - 靠近存储，用于分配能量
            if(room.storage) {
                linkPositions.push({
                    x: room.storage.pos.x - 1,
                    y: room.storage.pos.y,
                    type: 'receiver',
                    priority: 2
                });
            } else {
                linkPositions.push({
                    x: center.x - 2,
                    y: center.y,
                    type: 'receiver',
                    priority: 2
                });
            }
            
            // 添加链接
            for(let i = 0; i < Math.min(linkPositions.length, CONTROLLER_STRUCTURES[STRUCTURE_LINK][level]); i++) {
                structures.push({
                    type: STRUCTURE_LINK,
                    pos: {x: linkPositions[i].x, y: linkPositions[i].y}
                });
            }
            
            // 额外防御塔
            structures.push(
                {type: STRUCTURE_TOWER, pos: {x: center.x - 3, y: center.y + 3}},
                {type: STRUCTURE_TOWER, pos: {x: center.x + 3, y: center.y + 3}}
            );
            
            // 等级6：添加矿物提取器
            if(level >= 6) {
                // 寻找房间中的矿物
                const minerals = room.find(FIND_MINERALS);
                
                // 为每个矿物添加提取器
                minerals.forEach(mineral => {
                    structures.push({
                        type: STRUCTURE_EXTRACTOR,
                        pos: {x: mineral.pos.x, y: mineral.pos.y}
                    });
                    
                    // 在矿物周围添加容器，用于存储采集的矿物
                    // 寻找矿物周围可建造的位置
                    let containerAdded = false;
                    for(let dx = -1; dx <= 1 && !containerAdded; dx++) {
                        for(let dy = -1; dy <= 1 && !containerAdded; dy++) {
                            if(dx === 0 && dy === 0) continue; // 跳过矿物本身的位置
                            
                            const x = mineral.pos.x + dx;
                            const y = mineral.pos.y + dy;
                            
                            // 检查位置是否可建造
                            if(this.canBuildHere(room, x, y)) {
                                structures.push({
                                    type: STRUCTURE_CONTAINER,
                                    pos: {x: x, y: y}
                                });
                                containerAdded = true;
                            }
                        }
                    }
                });
            }
        }

        // 终极布局（等级7-8）
        if(level >= 7) {
            // 等级7-8：扩展数量
            // 等级7：最多50个扩展
            // 等级8：最多60个扩展
            const maxExtensions = level >= 8 ? 60 : 50;
            let extensionsAdded = 0;
            
            // 计算当前已有的扩展数量
            const currentExtensions = structures.filter(s => s.type === STRUCTURE_EXTENSION).length;
            
            // 在更大范围内添加扩展
            for(let radius = 4; radius <= 6; radius++) {
                // 如果已经达到最大扩展数量，跳出循环
                if(currentExtensions + extensionsAdded >= maxExtensions) break;
                
                // 在当前半径上添加扩展
                for(let dx = -radius; dx <= radius; dx++) {
                    for(let dy = -radius; dy <= radius; dy++) {
                        // 如果已经达到最大扩展数量，跳出循环
                        if(currentExtensions + extensionsAdded >= maxExtensions) break;
                        
                        // 只在半径边缘上添加扩展
                        if(Math.max(Math.abs(dx), Math.abs(dy)) === radius) {
                            // 避开已有建筑的位置
                            if(!this.positionHasStructure(structures, center.x + dx, center.y + dy)) {
                                structures.push({type: STRUCTURE_EXTENSION, pos: {x: center.x + dx, y: center.y + dy}});
                                extensionsAdded++;
                            }
                        }
                    }
                    
                    // 如果已经达到最大扩展数量，跳出循环
                    if(currentExtensions + extensionsAdded >= maxExtensions) break;
                }
            }
            
            // 添加额外的母巢（等级7：最多2个，等级8：最多3个）
            const currentSpawns = room.find(FIND_MY_SPAWNS).length;
            const maxSpawns = CONTROLLER_STRUCTURES[STRUCTURE_SPAWN][level];
            
            if(currentSpawns < maxSpawns) {
                // 定义额外母巢的位置
                const spawnPositions = [
                    {x: center.x - 4, y: center.y - 4}, // 左上角母巢（等级7）
                    {x: center.x + 4, y: center.y + 4}  // 右下角母巢（等级8）
                ];
                
                // 添加额外的母巢
                for(let i = 0; i < maxSpawns - currentSpawns; i++) {
                    if(i < spawnPositions.length) {
                        const pos = spawnPositions[i];
                        
                        // 检查位置是否可建造
                        if(this.canBuildHere(room, pos.x, pos.y)) {
                            structures.push({
                                type: STRUCTURE_SPAWN,
                                pos: {x: pos.x, y: pos.y}
                            });
                            
                            // 在母巢位置添加城墙保护
                            structures.push({
                                type: STRUCTURE_RAMPART,
                                pos: {x: pos.x, y: pos.y}
                            });
                            
                            console.log(`计划在房间 ${room.name} 添加额外母巢，位置: (${pos.x}, ${pos.y})`);
                        } else {
                            // 如果指定位置不可建造，尝试在周围找一个可建造的位置
                            let spawnAdded = false;
                            for(let dx = -1; dx <= 1 && !spawnAdded; dx++) {
                                for(let dy = -1; dy <= 1 && !spawnAdded; dy++) {
                                    if(dx === 0 && dy === 0) continue;
                                    
                                    const x = pos.x + dx;
                                    const y = pos.y + dy;
                                    
                                    if(this.canBuildHere(room, x, y)) {
                                        structures.push({
                                            type: STRUCTURE_SPAWN,
                                            pos: {x: x, y: y}
                                        });
                                        
                                        // 在母巢位置添加城墙保护
                                        structures.push({
                                            type: STRUCTURE_RAMPART,
                                            pos: {x: x, y: y}
                                        });
                                        
                                        console.log(`计划在房间 ${room.name} 添加额外母巢，位置: (${x}, ${y})`);
                                        spawnAdded = true;
                                    }
                                }
                            }
                            
                            // 如果周围也没有可建造的位置，尝试在房间的其他位置
                            if(!spawnAdded) {
                                // 在中心区域寻找可建造的位置
                                for(let radius = 3; radius <= 6 && !spawnAdded; radius++) {
                                    for(let dx = -radius; dx <= radius && !spawnAdded; dx++) {
                                        for(let dy = -radius; dy <= radius && !spawnAdded; dy++) {
                                            // 只在半径边缘上寻找
                                            if(Math.max(Math.abs(dx), Math.abs(dy)) === radius) {
                                                const x = center.x + dx;
                                                const y = center.y + dy;
                                                
                                                if(this.canBuildHere(room, x, y)) {
                                                    structures.push({
                                                        type: STRUCTURE_SPAWN,
                                                        pos: {x: x, y: y}
                                                    });
                                                    
                                                    // 在母巢位置添加城墙保护
                                                    structures.push({
                                                        type: STRUCTURE_RAMPART,
                                                        pos: {x: x, y: y}
                                                    });
                                                    
                                                    console.log(`计划在房间 ${room.name} 添加额外母巢，位置: (${x}, ${y})`);
                                                    spawnAdded = true;
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            
            // 工厂
            structures.push(
                {type: STRUCTURE_FACTORY, pos: {x: center.x, y: center.y + 4}}
            );
            
            // 终端
            structures.push(
                {type: STRUCTURE_TERMINAL, pos: {x: center.x - 4, y: center.y}}
            );
            
            // 观察者
            structures.push(
                {type: STRUCTURE_OBSERVER, pos: {x: center.x + 4, y: center.y}}
            );
            
            // 等级7：额外链接（最多4个）
            if(level >= 7) {
                // 寻找房间中的能量源
                const sources = room.find(FIND_SOURCES);
                
                // 为每个能量源添加一个链接（发送者）
                const sourceLinkPositions = [];
                sources.forEach(source => {
                    // 寻找源周围可建造的位置
                    for(let dx = -1; dx <= 1; dx++) {
                        for(let dy = -1; dy <= 1; dy++) {
                            if(dx === 0 && dy === 0) continue; // 跳过源本身的位置
                            
                            const x = source.pos.x + dx;
                            const y = source.pos.y + dy;
                            
                            // 检查位置是否可建造
                            if(this.canBuildHere(room, x, y)) {
                                sourceLinkPositions.push({
                                    x: x,
                                    y: y,
                                    type: 'sender',
                                    priority: 3
                                });
                                break; // 每个源只添加一个链接
                            }
                        }
                    }
                });
                
                // 计算当前已有的链接数量
                const currentLinks = structures.filter(s => s.type === STRUCTURE_LINK).length;
                
                // 添加额外的链接
                const maxLinks = CONTROLLER_STRUCTURES[STRUCTURE_LINK][level];
                const remainingLinks = maxLinks - currentLinks;
                
                // 按优先级排序链接位置
                sourceLinkPositions.sort((a, b) => a.priority - b.priority);
                
                // 添加链接
                for(let i = 0; i < Math.min(remainingLinks, sourceLinkPositions.length); i++) {
                    structures.push({
                        type: STRUCTURE_LINK,
                        pos: {x: sourceLinkPositions[i].x, y: sourceLinkPositions[i].y}
                    });
                }
            }
            
            // 等级7：额外实验室（最多6个）
            if(level >= 7) {
                // 创建实验室六边形布局，确保它们之间的距离在2格以内
                const labPositions = [
                    // 基础三个实验室（与等级6相同）
                    {x: center.x - 2, y: center.y - 2}, // 左上
                    {x: center.x, y: center.y - 2},     // 中上
                    {x: center.x - 1, y: center.y - 4}, // 上方
                    
                    // 等级7新增的实验室
                    {x: center.x + 2, y: center.y - 2}, // 右上
                    {x: center.x - 3, y: center.y - 4}, // 左上方
                    {x: center.x + 1, y: center.y - 4}  // 右上方
                ];
                
                // 添加实验室
                for(let i = 0; i < Math.min(6, CONTROLLER_STRUCTURES[STRUCTURE_LAB][level]); i++) {
                    // 避免重复添加已有的实验室
                    if(i < 3 && level === 7) {
                        // 跳过前三个实验室，因为它们已经在等级6时添加
                        continue;
                    }
                    
                    structures.push({
                        type: STRUCTURE_LAB,
                        pos: labPositions[i]
                    });
                }
            }
            
            // 等级8：更多实验室（最多10个）和其他建筑
            if(level >= 8) {
                // 创建实验室完整布局，确保它们之间的距离在2格以内
                const labPositions = [
                    // 基础六个实验室（与等级7相同）
                    {x: center.x - 2, y: center.y - 2}, // 左上
                    {x: center.x, y: center.y - 2},     // 中上
                    {x: center.x - 1, y: center.y - 4}, // 上方
                    {x: center.x + 2, y: center.y - 2}, // 右上
                    {x: center.x - 3, y: center.y - 4}, // 左上方
                    {x: center.x + 1, y: center.y - 4}, // 右上方
                    
                    // 等级8新增的实验室
                    {x: center.x - 2, y: center.y - 6}, // 更上方左
                    {x: center.x, y: center.y - 6},     // 更上方中
                    {x: center.x + 2, y: center.y - 6}, // 更上方右
                    {x: center.x - 1, y: center.y - 8}  // 最上方
                ];
                
                // 添加实验室
                for(let i = 6; i < Math.min(10, CONTROLLER_STRUCTURES[STRUCTURE_LAB][level]); i++) {
                    structures.push({
                        type: STRUCTURE_LAB,
                        pos: labPositions[i]
                    });
                }
                
                // 更多防御塔
                structures.push(
                    {type: STRUCTURE_TOWER, pos: {x: center.x - 4, y: center.y - 3}},
                    {type: STRUCTURE_TOWER, pos: {x: center.x + 4, y: center.y - 3}},
                    {type: STRUCTURE_TOWER, pos: {x: center.x - 4, y: center.y + 3}}
                );
                
                // 核弹发射井
                structures.push(
                    {type: STRUCTURE_NUKER, pos: {x: center.x, y: center.y - 10}}
                );
                
                // 等级8：额外链接（最多6个）
                // 计算当前已有的链接数量
                const currentLinks = structures.filter(s => s.type === STRUCTURE_LINK).length;
                
                // 如果还没有达到最大链接数量，添加额外的链接
                if(currentLinks < CONTROLLER_STRUCTURES[STRUCTURE_LINK][level]) {
                    // 在矿区添加链接
                    const minerals = room.find(FIND_MINERALS);
                    minerals.forEach(mineral => {
                        // 如果已经达到最大链接数量，跳出循环
                        if(structures.filter(s => s.type === STRUCTURE_LINK).length >= CONTROLLER_STRUCTURES[STRUCTURE_LINK][level]) return;
                        
                        // 寻找矿物周围可建造的位置
                        for(let dx = -1; dx <= 1; dx++) {
                            for(let dy = -1; dy <= 1; dy++) {
                                if(dx === 0 && dy === 0) continue; // 跳过矿物本身的位置
                                
                                const x = mineral.pos.x + dx;
                                const y = mineral.pos.y + dy;
                                
                                // 检查位置是否可建造
                                if(this.canBuildHere(room, x, y)) {
                                    structures.push({
                                        type: STRUCTURE_LINK,
                                        pos: {x: x, y: y}
                                    });
                                    return; // 每个矿物只添加一个链接
                                }
                            }
                        }
                    });
                    
                    // 在房间的其他战略位置添加链接
                    const strategicPositions = [
                        {x: center.x + 5, y: center.y + 5}, // 右下角
                        {x: center.x - 5, y: center.y + 5}, // 左下角
                        {x: center.x + 5, y: center.y - 5}, // 右上角
                        {x: center.x - 5, y: center.y - 5}  // 左上角
                    ];
                    
                    for(let pos of strategicPositions) {
                        // 如果已经达到最大链接数量，跳出循环
                        if(structures.filter(s => s.type === STRUCTURE_LINK).length >= CONTROLLER_STRUCTURES[STRUCTURE_LINK][level]) break;
                        
                        // 检查位置是否可建造
                        if(this.canBuildHere(room, pos.x, pos.y)) {
                            structures.push({
                                type: STRUCTURE_LINK,
                                pos: {x: pos.x, y: pos.y}
                            });
                        }
                    }
                }
            }
        }

        return structures;
    },

    // 检查位置是否已有建筑
    positionHasStructure: function(structures, x, y) {
        return structures.some(s => s.pos.x === x && s.pos.y === y);
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
            case STRUCTURE_EXTRACTOR:
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