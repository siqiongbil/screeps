// constructionManager.js
// 建筑调度模块：自动在合适位置创建 Terminal、Labs、Storage、Link 等关键建筑的施工工地
module.exports.scheduleConstruction = function (room) {
    // 获取房间控制器等级
    const controllerLevel = room.controller.level;

    // 获取已有的结构和施工工地
    const structures = room.find(FIND_MY_STRUCTURES);
    const constructionSites = room.find(FIND_CONSTRUCTION_SITES);

    // 获取房间中的 Sources
    const sources = room.find(FIND_SOURCES);

    // 获取房间中的 Spawn
    const spawns = room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_SPAWN });

    // 获取房间中的 Storage
    const storage = room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_STORAGE });

    // 获取房间中的 Controller
    const controller = room.controller;

    // 获取房间中的 Minerals
    const minerals = room.find(FIND_MINERALS);

    // 获取房间中的 Extractor
    const extractors = room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_EXTRACTOR });

    // 获取房间中的 Links
    const links = room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_LINK });

    // 获取房间中的 Towers
    const towers = room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_TOWER });

    // 获取房间中的 Labs
    const labs = room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_LAB });

    // 获取房间中的 Terminal
    const terminals = room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_TERMINAL });

    // 获取房间中的 Roads
    const roads = room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_ROAD });

    // 获取房间中的 Construction Sites
    const extensionSites = constructionSites.filter(s => s.structureType === STRUCTURE_EXTENSION);
    const storageSites = constructionSites.filter(s => s.structureType === STRUCTURE_STORAGE);
    const linkSites = constructionSites.filter(s => s.structureType === STRUCTURE_LINK);
    const towerSites = constructionSites.filter(s => s.structureType === STRUCTURE_TOWER);
    const labSites = constructionSites.filter(s => s.structureType === STRUCTURE_LAB);
    const terminalSites = constructionSites.filter(s => s.structureType === STRUCTURE_TERMINAL);
    const roadSites = constructionSites.filter(s => s.structureType === STRUCTURE_ROAD);
    const extractorSites = constructionSites.filter(s => s.structureType === STRUCTURE_EXTRACTOR);

    // 检查并重新创建被摧毁或损毁的建筑
    checkAndRecreateStructures(room, STRUCTURE_STORAGE, storage, storageSites, createStorage);
    checkAndRecreateStructures(room, STRUCTURE_LINK, links, linkSites, createLinks);
    checkAndRecreateStructures(room, STRUCTURE_EXTRACTOR, extractors, extractorSites, createExtractor, minerals);
    checkAndRecreateStructures(room, STRUCTURE_TOWER, towers, towerSites, createTowers, 1);
    checkAndRecreateStructures(room, STRUCTURE_LAB, labs, labSites, createLabs, 3);
    checkAndRecreateStructures(room, STRUCTURE_TERMINAL, terminals, terminalSites, createTerminal);

    // 根据控制器等级动态调整建筑的建造顺序和数量
    switch (controllerLevel) {
        case 1:
            // 控制器等级 1：仅创建道路
            createRoads(room, spawns, sources, controller);
            break;
        case 2:
            // 控制器等级 2：创建道路和 Extension
            createRoads(room, spawns, sources, controller);
            createExtensions(room, 5);
            break;
        case 3:
            // 控制器等级 3：创建道路、Extension 和 Tower
            createRoads(room, spawns, sources, controller);
            createExtensions(room, 10);
            createTowers(room, 1);
            break;
        case 4:
            // 控制器等级 4：创建道路、Extension、Tower 和 Storage
            createRoads(room, spawns, sources, controller);
            createExtensions(room, 20);
            createTowers(room, 3);
            createStorage(room);
            break;
        case 5:
            // 控制器等级 5：创建道路、Extension、Tower、Storage 和 Link
            createRoads(room, spawns, sources, controller);
            createExtensions(room, 30);
            createTowers(room, 5);
            createStorage(room);
            createLinks(room, 2);
            break;
        case 6:
            // 控制器等级 6：创建道路、Extension、Tower、Storage、Link 和 Extractor
            createRoads(room, spawns, sources, controller);
            createExtensions(room, 40);
            createTowers(room, 6);
            createStorage(room);
            createLinks(room, 3);
            createExtractor(room, minerals);
            break;
        case 7:
            // 控制器等级 7：创建道路、Extension、Tower、Storage、Link、Extractor 和 Labs
            createRoads(room, spawns, sources, controller);
            createExtensions(room, 50);
            createTowers(room, 8);
            createStorage(room);
            createLinks(room, 4);
            createExtractor(room, minerals);
            createLabs(room, 3);
            break;
        case 8:
            // 控制器等级 8：创建道路、Extension、Tower、Storage、Link、Extractor、Labs 和 Terminal
            createRoads(room, spawns, sources, controller);
            createExtensions(room, 60);
            createTowers(room, 10);
            createStorage(room);
            createLinks(room, 6);
            createExtractor(room, minerals);
            createLabs(room, 6);
            createTerminal(room);
            break;
        default:
            // 控制器等级 9 及以上：继续创建更多 Extension、Tower 和 Labs
            createRoads(room, spawns, sources, controller);
            createExtensions(room, 60);
            createTowers(room, 10);
            createStorage(room);
            createLinks(room, 6);
            createExtractor(room, minerals);
            createLabs(room, 10);
            createTerminal(room);
            break;
    }

    // 检查 CPU 使用情况
    if (Game.cpu.getUsed() > Game.cpu.tickLimit * 0.9) {
        console.log(`CPU usage is high: ${Game.cpu.getUsed()}/${Game.cpu.tickLimit}`);
        return;
    }
};

// 创建道路
function createRoads(room, spawns, sources, controller) {
    spawns.forEach(spawn => {
        sources.forEach(source => {
            createPath(room, spawn.pos, source.pos, STRUCTURE_ROAD);
        });
        createPath(room, spawn.pos, controller.pos, STRUCTURE_ROAD);
    });
}

// 创建路径
function createPath(room, startPos, endPos, structureType) {
    const path = startPos.findPathTo(endPos);
    path.forEach(step => {
        const pos = new RoomPosition(step.x, step.y, room.name);
        if (!room.lookForAt(LOOK_STRUCTURES, pos).some(s => s.structureType === structureType) &&
            !room.lookForAt(LOOK_CONSTRUCTION_SITES, pos).some(s => s.structureType === structureType)) {
            const result = room.createConstructionSite(pos, structureType);
            if (result === OK) {
                console.log(`${structureType} construction site created at ${pos}`);
            }
        }
    });
}

// 创建 Extension
function createExtensions(room, maxExtensions) {
    const currentExtensions = room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_EXTENSION });
    const currentExtensionSites = room.find(FIND_CONSTRUCTION_SITES, { filter: s => s.structureType === STRUCTURE_EXTENSION });
    const totalExtensions = currentExtensions.length + currentExtensionSites.length;

    if (totalExtensions < maxExtensions) {
        for (let i = totalExtensions; i < maxExtensions; i++) {
            let pos = room.getPositionAt(25 + i % 5, 25 + Math.floor(i / 5)); // 固定位置，移除随机偏移
            pos = findAvailablePosition(room, pos, STRUCTURE_EXTENSION);
            if (pos) {
                const result = room.createConstructionSite(pos, STRUCTURE_EXTENSION);
                if (result === OK) {
                    console.log(`Extension construction site created at ${pos}`);
                }
            }
        }
    }
}

// 创建 Tower
function createTowers(room, maxTowers) {
    const currentTowers = room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_TOWER });
    const currentTowerSites = room.find(FIND_CONSTRUCTION_SITES, { filter: s => s.structureType === STRUCTURE_TOWER });
    const totalTowers = currentTowers.length + currentTowerSites.length;

    if (totalTowers < maxTowers) {
        for (let i = totalTowers; i < maxTowers; i++) {
            let pos = room.getPositionAt(25 + i % 5, 25 + Math.floor(i / 5)); // 可以根据需要调整位置
            pos = findAvailablePosition(room, pos, STRUCTURE_TOWER);
            if (pos) {
                const result = room.createConstructionSite(pos, STRUCTURE_TOWER);
                if (result === OK) {
                    console.log(`Tower construction site created at ${pos}`);
                }
            }
        }
    }
}

// 创建 Storage
function createStorage(room) {
    const currentStorages = room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_STORAGE });
    const currentStorageSites = room.find(FIND_CONSTRUCTION_SITES, { filter: s => s.structureType === STRUCTURE_STORAGE });

    if (currentStorages.length === 0 && currentStorageSites.length === 0) {
        let pos = new RoomPosition(25, 25, room.name); // 可以根据需要调整位置
        pos = findAvailablePosition(room, pos, STRUCTURE_STORAGE);
        if (pos) {
            const result = room.createConstructionSite(pos, STRUCTURE_STORAGE);
            if (result === OK) {
                console.log(`Storage construction site created at ${pos}`);
            }
        }
    }
}

// 创建 Link
function createLinks(room, maxLinks) {
    const currentLinks = room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_LINK });
    const currentLinkSites = room.find(FIND_CONSTRUCTION_SITES, { filter: s => s.structureType === STRUCTURE_LINK });
    const totalLinks = currentLinks.length + currentLinkSites.length;

    if (totalLinks < maxLinks) {
        for (let i = totalLinks; i < maxLinks; i++) {
            let pos = room.getPositionAt(25 + i % 5, 25 + Math.floor(i / 5)); // 可以根据需要调整位置
            pos = findAvailablePosition(room, pos, STRUCTURE_LINK);
            if (pos) {
                const result = room.createConstructionSite(pos, STRUCTURE_LINK);
                if (result === OK) {
                    console.log(`Link construction site created at ${pos}`);
                }
            }
        }
    }
}

// 创建 Extractor
function createExtractor(room, minerals) {
    const currentExtractors = room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_EXTRACTOR });
    const currentExtractorSites = room.find(FIND_CONSTRUCTION_SITES, { filter: s => s.structureType === STRUCTURE_EXTRACTOR });

    if (minerals.length > 0 && currentExtractors.length === 0 && currentExtractorSites.length === 0) {
        const mineral = minerals[0];
        let pos = mineral.pos;
        pos = findAvailablePosition(room, pos, STRUCTURE_EXTRACTOR);
        if (pos) {
            const result = room.createConstructionSite(pos, STRUCTURE_EXTRACTOR);
            if (result === OK) {
                console.log(`Extractor construction site created at ${pos}`);
            }
        }
    }
}

// 创建 Labs
function createLabs(room, maxLabs) {
    const currentLabs = room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_LAB });
    const currentLabSites = room.find(FIND_CONSTRUCTION_SITES, { filter: s => s.structureType === STRUCTURE_LAB });
    const totalLabs = currentLabs.length + currentLabSites.length;

    if (totalLabs < maxLabs) {
        for (let i = totalLabs; i < maxLabs; i++) {
            let pos = room.getPositionAt(25 + i % 5, 25 + Math.floor(i / 5)); // 可以根据需要调整位置
            pos = findAvailablePosition(room, pos, STRUCTURE_LAB);
            if (pos) {
                const result = room.createConstructionSite(pos, STRUCTURE_LAB);
                if (result === OK) {
                    console.log(`Lab construction site created at ${pos}`);
                }
            }
        }
    }
}

// 创建 Terminal
function createTerminal(room) {
    const currentTerminals = room.find(FIND_MY_STRUCTURES, { filter: s => s.structureType === STRUCTURE_TERMINAL });
    const currentTerminalSites = room.find(FIND_CONSTRUCTION_SITES, { filter: s => s.structureType === STRUCTURE_TERMINAL });

    if (currentTerminals.length === 0 && currentTerminalSites.length === 0) {
        let pos = new RoomPosition(25, 26, room.name); // 可以根据需要调整位置
        pos = findAvailablePosition(room, pos, STRUCTURE_TERMINAL);
        if (pos) {
            const result = room.createConstructionSite(pos, STRUCTURE_TERMINAL);
            if (result === OK) {
                console.log(`Terminal construction site created at ${pos}`);
            }
        }
    }
}

// 查找可用位置
function findAvailablePosition(room, initialPos, structureType) {
    const offsets = [
        { x: 0, y: 0 },
        { x: -1, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: -1 },
        { x: 0, y: 1 },
        { x: -1, y: -1 },
        { x: -1, y: 1 },
        { x: 1, y: -1 },
        { x: 1, y: 1 },
        // 可以继续添加更多偏移量
    ];

    for (const offset of offsets) {
        const pos = new RoomPosition(initialPos.x + offset.x, initialPos.y + offset.y, room.name);
        if (!room.lookForAt(LOOK_STRUCTURES, pos).some(s => s.structureType === structureType) &&
            !room.lookForAt(LOOK_CONSTRUCTION_SITES, pos).some(s => s.structureType === structureType) &&
            room.lookForAt(LOOK_TERRAIN, pos)[0].terrain !== 'wall'
            ) {
            return pos;
        }
    }

    return null; // 如果没有找到可用位置，返回 null
}

// 检查并重新创建被摧毁或损毁的建筑
function checkAndRecreateStructures(room, structureType, structures, constructionSites, createFunction, ...args) {
    const maxCount = getMaxCountForStructure(structureType, room.controller.level);
    const currentCount = structures.length + constructionSites.length;

    if (currentCount < maxCount) {
        createFunction(room, ...args);
    }
}

// 获取每种建筑在不同控制器等级下的最大数量
function getMaxCountForStructure(structureType, controllerLevel) {
    switch (structureType) {
        case STRUCTURE_STORAGE:
            return 1;
        case STRUCTURE_LINK:
            return getMaxLinksForControllerLevel(controllerLevel);
        case STRUCTURE_EXTRACTOR:
            return 1;
        case STRUCTURE_TOWER:
            return getMaxTowersForControllerLevel(controllerLevel);
        case STRUCTURE_LAB:
            return getMaxLabsForControllerLevel(controllerLevel);
        case STRUCTURE_TERMINAL:
            return 1;
        default:
            return 0;
    }
}

// 获取控制器等级对应的最大 Link 数量
function getMaxLinksForControllerLevel(controllerLevel) {
    switch (controllerLevel) {
        case 6:
            return 3;
        case 7:
            return 4;
        case 8:
            return 6;
        default:
            return 6;
    }
}

// 获取控制器等级对应的最大 Tower 数量
function getMaxTowersForControllerLevel(controllerLevel) {
    switch (controllerLevel) {
        case 3:
            return 1;
        case 4:
            return 3;
        case 5:
            return 5;
        case 6:
            return 6;
        case 7:
            return 8;
        case 8:
            return 10;
        default:
            return 10;
    }
}

// 获取控制器等级对应的最大 Lab 数量
function getMaxLabsForControllerLevel(controllerLevel) {
    switch (controllerLevel) {
        case 7:
            return 3;
        case 8:
            return 6;
        default:
            return 10;
    }
}
