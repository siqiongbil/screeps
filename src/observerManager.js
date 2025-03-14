/**
 * 观察者管理系统
 * 用于管理观察者，获取远程房间的视野
 */

module.exports = {
    // 主运行函数
    run: function(room) {
        // 每10个tick运行一次
        if(Game.time % 10 !== 0) return;
        
        // 检查房间控制器等级
        if(!room.controller || room.controller.level < 8) return;
        
        // 初始化内存
        if(!room.memory.observerManager) {
            this.initializeMemory(room);
        }
        
        try {
            // 获取观察者
            const observer = this.getObserver(room);
            if(!observer) return;
            
            // 更新观察者状态
            this.updateObserverStatus(room, observer);
            
            // 处理观察请求
            this.processObserveRequests(room, observer);
            
            // 执行自动观察
            this.runAutoObserve(room, observer);
            
            // 可视化观察者状态
            this.visualizeObserverStatus(room, observer);
        } catch(error) {
            console.log(`房间 ${room.name} 观察者管理系统错误：${error}`);
        }
    },
    
    // 初始化内存
    initializeMemory: function(room) {
        room.memory.observerManager = {
            status: {
                lastObservedRoom: null,
                lastObserveTime: 0,
                autoObserveEnabled: false,
                autoObserveMode: 'scout', // scout, mineral, hostile
                autoObserveRooms: []
            },
            observeRequests: [],
            observeHistory: {},
            scoutData: {}
        };
    },
    
    // 获取观察者
    getObserver: function(room) {
        return room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_OBSERVER
        })[0];
    },
    
    // 更新观察者状态
    updateObserverStatus: function(room, observer) {
        const observerManager = room.memory.observerManager;
        
        // 清理过期的请求
        observerManager.observeRequests = observerManager.observeRequests.filter(request => 
            Game.time - request.time < 1000
        );
        
        // 更新自动观察房间列表
        if(observerManager.status.autoObserveEnabled && 
           (!observerManager.status.autoObserveRooms || observerManager.status.autoObserveRooms.length === 0)) {
            this.updateAutoObserveRooms(room);
        }
    },
    
    // 处理观察请求
    processObserveRequests: function(room, observer) {
        const observerManager = room.memory.observerManager;
        
        // 如果没有请求，返回
        if(observerManager.observeRequests.length === 0) return;
        
        // 获取最高优先级的请求
        const request = observerManager.observeRequests.sort((a, b) => b.priority - a.priority)[0];
        
        // 检查目标房间是否在范围内
        if(!this.isRoomInRange(room.name, request.roomName)) {
            console.log(`[ObserverManager] 房间 ${request.roomName} 超出观察范围`);
            // 移除请求
            observerManager.observeRequests = observerManager.observeRequests.filter(r => 
                r.roomName !== request.roomName
            );
            return;
        }
        
        // 观察目标房间
        const result = observer.observeRoom(request.roomName);
        
        if(result === OK) {
            console.log(`[ObserverManager] 正在观察房间 ${request.roomName}`);
            
            // 更新状态
            observerManager.status.lastObservedRoom = request.roomName;
            observerManager.status.lastObserveTime = Game.time;
            
            // 记录观察历史
            if(!observerManager.observeHistory[request.roomName]) {
                observerManager.observeHistory[request.roomName] = [];
            }
            
            observerManager.observeHistory[request.roomName].push({
                time: Game.time,
                reason: request.reason
            });
            
            // 限制历史记录长度
            if(observerManager.observeHistory[request.roomName].length > 10) {
                observerManager.observeHistory[request.roomName] = 
                    observerManager.observeHistory[request.roomName].slice(-10);
            }
            
            // 移除请求
            observerManager.observeRequests = observerManager.observeRequests.filter(r => 
                r.roomName !== request.roomName
            );
            
            // 下一个tick收集数据
            observerManager.pendingDataCollection = {
                roomName: request.roomName,
                time: Game.time
            };
        } else {
            console.log(`[ObserverManager] 观察房间 ${request.roomName} 失败，错误码：${result}`);
        }
    },
    
    // 执行自动观察
    runAutoObserve: function(room, observer) {
        const observerManager = room.memory.observerManager;
        
        // 如果有待处理的数据收集，先处理
        if(observerManager.pendingDataCollection) {
            const collection = observerManager.pendingDataCollection;
            
            // 检查是否是下一个tick
            if(Game.time === collection.time + 1) {
                // 收集目标房间数据
                this.collectRoomData(room, collection.roomName);
            }
            
            // 清除待处理的数据收集
            delete observerManager.pendingDataCollection;
        }
        
        // 如果自动观察未启用或有观察请求，返回
        if(!observerManager.status.autoObserveEnabled || observerManager.observeRequests.length > 0) return;
        
        // 如果没有自动观察房间，返回
        if(!observerManager.status.autoObserveRooms || observerManager.status.autoObserveRooms.length === 0) return;
        
        // 获取下一个要观察的房间
        const nextRoomIndex = (Game.time / 10) % observerManager.status.autoObserveRooms.length;
        const nextRoom = observerManager.status.autoObserveRooms[Math.floor(nextRoomIndex)];
        
        // 观察目标房间
        const result = observer.observeRoom(nextRoom);
        
        if(result === OK) {
            // 更新状态
            observerManager.status.lastObservedRoom = nextRoom;
            observerManager.status.lastObserveTime = Game.time;
            
            // 记录观察历史
            if(!observerManager.observeHistory[nextRoom]) {
                observerManager.observeHistory[nextRoom] = [];
            }
            
            observerManager.observeHistory[nextRoom].push({
                time: Game.time,
                reason: 'auto'
            });
            
            // 限制历史记录长度
            if(observerManager.observeHistory[nextRoom].length > 10) {
                observerManager.observeHistory[nextRoom] = 
                    observerManager.observeHistory[nextRoom].slice(-10);
            }
            
            // 下一个tick收集数据
            observerManager.pendingDataCollection = {
                roomName: nextRoom,
                time: Game.time
            };
        }
    },
    
    // 收集房间数据
    collectRoomData: function(room, targetRoomName) {
        // 检查是否有目标房间的视野
        if(!Game.rooms[targetRoomName]) {
            console.log(`[ObserverManager] 无法获取房间 ${targetRoomName} 的视野`);
            return;
        }
        
        const targetRoom = Game.rooms[targetRoomName];
        const observerManager = room.memory.observerManager;
        
        // 初始化房间数据
        if(!observerManager.scoutData[targetRoomName]) {
            observerManager.scoutData[targetRoomName] = {
                lastUpdate: Game.time,
                controller: null,
                sources: [],
                minerals: [],
                structures: {},
                hostiles: 0,
                terrain: {}
            };
        }
        
        const roomData = observerManager.scoutData[targetRoomName];
        roomData.lastUpdate = Game.time;
        
        // 收集控制器信息
        if(targetRoom.controller) {
            roomData.controller = {
                id: targetRoom.controller.id,
                level: targetRoom.controller.level,
                owner: targetRoom.controller.owner ? targetRoom.controller.owner.username : null,
                reservation: targetRoom.controller.reservation ? {
                    username: targetRoom.controller.reservation.username,
                    ticksToEnd: targetRoom.controller.reservation.ticksToEnd
                } : null
            };
        }
        
        // 收集能源源信息
        roomData.sources = targetRoom.find(FIND_SOURCES).map(source => ({
            id: source.id,
            pos: {x: source.pos.x, y: source.pos.y},
            energy: source.energy,
            energyCapacity: source.energyCapacity
        }));
        
        // 收集矿物信息
        roomData.minerals = targetRoom.find(FIND_MINERALS).map(mineral => ({
            id: mineral.id,
            pos: {x: mineral.pos.x, y: mineral.pos.y},
            mineralType: mineral.mineralType,
            mineralAmount: mineral.mineralAmount
        }));
        
        // 收集建筑信息
        const structures = targetRoom.find(FIND_STRUCTURES);
        roomData.structures = {};
        
        for(let structure of structures) {
            const type = structure.structureType;
            if(!roomData.structures[type]) {
                roomData.structures[type] = [];
            }
            
            roomData.structures[type].push({
                id: structure.id,
                pos: {x: structure.pos.x, y: structure.pos.y}
            });
        }
        
        // 收集敌对creep信息
        const hostiles = targetRoom.find(FIND_HOSTILE_CREEPS);
        roomData.hostiles = hostiles.length;
        
        if(hostiles.length > 0) {
            roomData.hostileDetails = hostiles.map(hostile => ({
                id: hostile.id,
                owner: hostile.owner.username,
                body: hostile.body.map(part => part.type),
                pos: {x: hostile.pos.x, y: hostile.pos.y}
            }));
        } else {
            delete roomData.hostileDetails;
        }
        
        // 如果发现敌对creep，添加警报
        if(hostiles.length > 0) {
            console.log(`[ObserverManager] 警告：在房间 ${targetRoomName} 发现 ${hostiles.length} 个敌对creep`);
            
            // 如果有监控系统，添加异常记录
            if(room.memory.monitor) {
                if(!room.memory.monitor.anomalies) {
                    room.memory.monitor.anomalies = [];
                }
                
                room.memory.monitor.anomalies.push({
                    type: 'hostileDetected',
                    roomName: targetRoomName,
                    count: hostiles.length,
                    time: Game.time
                });
            }
        }
        
        console.log(`[ObserverManager] 已收集房间 ${targetRoomName} 的数据`);
    },
    
    // 更新自动观察房间列表
    updateAutoObserveRooms: function(room) {
        const observerManager = room.memory.observerManager;
        
        // 获取当前房间的坐标
        const roomCoords = this.parseRoomName(room.name);
        if(!roomCoords) return;
        
        // 生成10范围内的所有房间名称
        const autoObserveRooms = [];
        
        for(let dx = -10; dx <= 10; dx++) {
            for(let dy = -10; dy <= 10; dy++) {
                // 跳过当前房间
                if(dx === 0 && dy === 0) continue;
                
                // 计算目标房间坐标
                const targetX = roomCoords.x + dx;
                const targetY = roomCoords.y + dy;
                
                // 生成房间名称
                const targetRoomName = this.formatRoomName(targetX, targetY);
                
                // 检查房间是否有效
                if(Game.map.getRoomStatus(targetRoomName).status !== 'closed') {
                    autoObserveRooms.push(targetRoomName);
                }
            }
        }
        
        // 根据模式过滤房间
        if(observerManager.status.autoObserveMode === 'mineral') {
            // 优先观察有矿物的房间
            const mineralRooms = autoObserveRooms.filter(roomName => 
                observerManager.scoutData[roomName] && 
                observerManager.scoutData[roomName].minerals && 
                observerManager.scoutData[roomName].minerals.length > 0
            );
            
            if(mineralRooms.length > 0) {
                observerManager.status.autoObserveRooms = mineralRooms;
                return;
            }
        } else if(observerManager.status.autoObserveMode === 'hostile') {
            // 优先观察有敌人的房间
            const hostileRooms = autoObserveRooms.filter(roomName => 
                observerManager.scoutData[roomName] && 
                observerManager.scoutData[roomName].hostiles > 0
            );
            
            if(hostileRooms.length > 0) {
                observerManager.status.autoObserveRooms = hostileRooms;
                return;
            }
        }
        
        // 默认模式：按距离排序
        observerManager.status.autoObserveRooms = autoObserveRooms.sort((a, b) => {
            const coordsA = this.parseRoomName(a);
            const coordsB = this.parseRoomName(b);
            
            if(!coordsA || !coordsB) return 0;
            
            const distA = Math.abs(coordsA.x - roomCoords.x) + Math.abs(coordsA.y - roomCoords.y);
            const distB = Math.abs(coordsB.x - roomCoords.x) + Math.abs(coordsB.y - roomCoords.y);
            
            return distA - distB;
        });
    },
    
    // 可视化观察者状态
    visualizeObserverStatus: function(room, observer) {
        const observerManager = room.memory.observerManager;
        const visual = room.visual;
        
        // 绘制观察者状态
        visual.circle(observer.pos, {
            radius: 0.5,
            fill: observerManager.status.autoObserveEnabled ? '#00ff00' : '#ff0000',
            opacity: 0.5
        });
        
        // 显示最后观察的房间
        if(observerManager.status.lastObservedRoom) {
            visual.text(`观察: ${observerManager.status.lastObservedRoom}`, 
                observer.pos.x, observer.pos.y - 0.5, {
                color: 'white',
                font: 0.4
            });
        }
        
        // 显示模式
        visual.text(`模式: ${this.getModeName(observerManager.status.autoObserveMode)}`, 
            observer.pos.x, observer.pos.y + 0.5, {
            color: 'white',
            font: 0.4
        });
    },
    
    // 获取模式名称
    getModeName: function(mode) {
        const modeNames = {
            'scout': '侦察',
            'mineral': '矿物',
            'hostile': '敌对'
        };
        
        return modeNames[mode] || mode;
    },
    
    // 添加观察请求
    addObserveRequest: function(room, targetRoomName, reason, priority) {
        // 检查房间是否有观察者
        const observer = this.getObserver(room);
        if(!observer) {
            return `房间 ${room.name} 没有观察者`;
        }
        
        // 检查目标房间是否在范围内
        if(!this.isRoomInRange(room.name, targetRoomName)) {
            return `房间 ${targetRoomName} 超出观察范围`;
        }
        
        // 初始化内存
        if(!room.memory.observerManager) {
            this.initializeMemory(room);
        }
        
        const observerManager = room.memory.observerManager;
        
        // 检查是否已经有相同的请求
        const existingRequest = observerManager.observeRequests.find(request => 
            request.roomName === targetRoomName
        );
        
        if(existingRequest) {
            // 更新优先级
            existingRequest.priority = Math.max(existingRequest.priority, priority || 1);
            existingRequest.reason = reason;
            existingRequest.time = Game.time;
            
            return `已更新对房间 ${targetRoomName} 的观察请求`;
        }
        
        // 添加新请求
        observerManager.observeRequests.push({
            roomName: targetRoomName,
            reason: reason,
            priority: priority || 1,
            time: Game.time
        });
        
        return `已添加对房间 ${targetRoomName} 的观察请求`;
    },
    
    // 设置自动观察模式
    setAutoObserveMode: function(room, enabled, mode) {
        // 检查房间是否有观察者
        const observer = this.getObserver(room);
        if(!observer) {
            return `房间 ${room.name} 没有观察者`;
        }
        
        // 初始化内存
        if(!room.memory.observerManager) {
            this.initializeMemory(room);
        }
        
        const observerManager = room.memory.observerManager;
        
        // 更新状态
        observerManager.status.autoObserveEnabled = enabled;
        
        if(mode) {
            observerManager.status.autoObserveMode = mode;
        }
        
        // 更新自动观察房间列表
        this.updateAutoObserveRooms(room);
        
        return `已${enabled ? '启用' : '禁用'}自动观察，模式：${this.getModeName(observerManager.status.autoObserveMode)}`;
    },
    
    // 获取房间数据
    getRoomData: function(room, targetRoomName) {
        // 初始化内存
        if(!room.memory.observerManager) {
            this.initializeMemory(room);
        }
        
        const observerManager = room.memory.observerManager;
        
        // 检查是否有目标房间的数据
        if(!observerManager.scoutData[targetRoomName]) {
            return `没有房间 ${targetRoomName} 的数据`;
        }
        
        const roomData = observerManager.scoutData[targetRoomName];
        const timeSinceUpdate = Game.time - roomData.lastUpdate;
        
        // 生成报告
        let report = `=== 房间 ${targetRoomName} 数据报告 ===\n`;
        report += `最后更新: ${timeSinceUpdate} ticks前\n\n`;
        
        // 控制器信息
        if(roomData.controller) {
            report += `控制器: ${roomData.controller.level || '无'} 级\n`;
            if(roomData.controller.owner) {
                report += `所有者: ${roomData.controller.owner}\n`;
            }
            if(roomData.controller.reservation) {
                report += `预定: ${roomData.controller.reservation.username} (${roomData.controller.reservation.ticksToEnd} ticks)\n`;
            }
        } else {
            report += `控制器: 无\n`;
        }
        
        // 能源源信息
        report += `\n能源源: ${roomData.sources.length} 个\n`;
        roomData.sources.forEach((source, index) => {
            report += `  ${index+1}. 位置: (${source.pos.x},${source.pos.y}), 能量: ${source.energy}/${source.energyCapacity}\n`;
        });
        
        // 矿物信息
        report += `\n矿物: ${roomData.minerals.length} 个\n`;
        roomData.minerals.forEach((mineral, index) => {
            report += `  ${index+1}. 类型: ${mineral.mineralType}, 数量: ${mineral.mineralAmount}, 位置: (${mineral.pos.x},${mineral.pos.y})\n`;
        });
        
        // 建筑信息
        report += `\n建筑:\n`;
        for(let type in roomData.structures) {
            report += `  ${type}: ${roomData.structures[type].length} 个\n`;
        }
        
        // 敌对creep信息
        report += `\n敌对creep: ${roomData.hostiles} 个\n`;
        if(roomData.hostileDetails && roomData.hostileDetails.length > 0) {
            roomData.hostileDetails.forEach((hostile, index) => {
                report += `  ${index+1}. 所有者: ${hostile.owner}, 位置: (${hostile.pos.x},${hostile.pos.y})\n`;
                report += `     身体部件: ${hostile.body.join(', ')}\n`;
            });
        }
        
        return report;
    },
    
    // 检查房间是否在观察范围内
    isRoomInRange: function(roomName, targetRoomName) {
        const roomCoords = this.parseRoomName(roomName);
        const targetCoords = this.parseRoomName(targetRoomName);
        
        if(!roomCoords || !targetCoords) return false;
        
        const distance = Math.max(
            Math.abs(roomCoords.x - targetCoords.x),
            Math.abs(roomCoords.y - targetCoords.y)
        );
        
        return distance <= 10;
    },
    
    // 解析房间名称
    parseRoomName: function(roomName) {
        const match = roomName.match(/^([WE])([0-9]+)([NS])([0-9]+)$/);
        if(!match) return null;
        
        const x = (match[1] === 'W' ? -1 : 1) * parseInt(match[2]);
        const y = (match[3] === 'N' ? -1 : 1) * parseInt(match[4]);
        
        return {x, y};
    },
    
    // 格式化房间名称
    formatRoomName: function(x, y) {
        const xDir = x < 0 ? 'W' : 'E';
        const yDir = y < 0 ? 'N' : 'S';
        
        return `${xDir}${Math.abs(x)}${yDir}${Math.abs(y)}`;
    }
}; 