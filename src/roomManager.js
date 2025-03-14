// roomManager.js - 房间管理模块

class RoomManager {
    static getAccessibleRooms() {
        const rooms = {};
        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (room && room.controller && room.controller.my) {
                rooms[roomName] = room;
            }
        }
        return rooms;
    }

    static isRoomAccessible(roomName) {
        const room = Game.rooms[roomName];
        return room && room.controller && room.controller.my;
    }

    static cleanupInvalidRooms() {
        for (const roomName in Memory.rooms) {
            if (!Game.rooms[roomName]) {
                delete Memory.rooms[roomName];
                console.log(`已清理无效房间内存: ${roomName}`);
            }
        }
    }

    static initializeRoomMemory(room) {
        // 确保 Memory.rooms 存在
        if (!Memory.rooms) {
            Memory.rooms = {};
        }
        
        // 初始化房间内存
        if (!Memory.rooms[room.name]) {
            Memory.rooms[room.name] = {
                sources: room.find(FIND_SOURCES).map(s => s.id),
                minerals: room.find(FIND_MINERALS).map(m => m.id),
                lastUpdate: Game.time,
                creepRoles: {},
                constructionSites: [],
                repairTargets: [],
                defenseMatrix: {},
                spawnQueue: [],
                resourceRequests: []
            };
        }

        // 确保全局统计对象存在
        if (!global.roomStats) {
            global.roomStats = {};
        }
    }
}

module.exports = RoomManager; 