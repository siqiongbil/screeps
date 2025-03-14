class RoomManager {
    constructor(room) {
        this.room = room;
        this.cache = {};
        
        // 添加房间有效性检查
        if (!this.isValidRoom()) {
            throw new Error(`房间 ${room ? room.name : 'undefined'} 无效或无法访问`);
        }
    }

    isValidRoom() {
        return this.room && 
               this.room.controller && 
               this.room.controller.my &&
               Game.rooms[this.room.name];
    }

    // ... rest of the RoomManager class ...
}

module.exports = {
    // ... existing code ...

    // 添加房间访问检查函数
    checkRoomAccess: function(roomName) {
        const room = Game.rooms[roomName];
        if (!room) {
            console.log(`无法访问房间 ${roomName}`);
            return false;
        }
        if (!room.controller) {
            console.log(`房间 ${roomName} 没有控制器`);
            return false;
        }
        if (!room.controller.my) {
            console.log(`房间 ${roomName} 不属于我们`);
            return false;
        }
        return true;
    },

    // 安全的房间操作函数
    safeRoomOperation: function(roomName, operation) {
        const room = Game.rooms[roomName];
        if (!room) {
            console.log(`无法访问房间 ${roomName}`);
            return null;
        }
        try {
            return operation(room);
        } catch (error) {
            console.log(`房间 ${roomName} 操作错误: ${error.stack || error}`);
            return null;
        }
    }
}; 