// 内存管理模块
const memoryManager = {
    // 初始化内存
    initMemory: function() {
        // 初始化全局内存
        if(!Memory.spawns) {
            Memory.spawns = { queues: {} };
        }
        
        // 初始化房间内存
        for(let roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            
            // 只处理我控制的房间
            if(room.controller && room.controller.my) {
                // 初始化能源状态
                this.initEnergyStatus(room);
                
                // 初始化能源分配器
                const energyDistributor = require('energyDistributor');
                energyDistributor.initializeMemory(room);
                
                // 初始化塔管理器
                if(!room.memory.towers) {
                    room.memory.towers = { ids: [] };
                }
                
                // 初始化链接管理器
                if(!room.memory.links) {
                    room.memory.links = { 
                        senders: [], 
                        receivers: [],
                        lastTransfer: 0
                    };
                }
                
                // 初始化建筑管理器
                if(!room.memory.construction) {
                    room.memory.construction = { 
                        sites: {},
                        lastUpdate: 0
                    };
                }
                
                // 初始化防御管理器
                if(!room.memory.defense) {
                    room.memory.defense = { 
                        hostiles: [],
                        lastAttack: 0,
                        threatLevel: 0
                    };
                }
                
                // 初始化资源管理器
                if(!room.memory.resources) {
                    room.memory.resources = { 
                        status: {},
                        storage: {},
                        terminal: {}
                    };
                }
                
                // 初始化市场管理器
                if(!room.memory.market) {
                    room.memory.market = { 
                        orders: {},
                        history: [],
                        lastUpdate: 0
                    };
                }
                
                // 初始化统计管理器
                if(!room.memory.stats) {
                    room.memory.stats = { 
                        energy: [],
                        progress: [],
                        creeps: {},
                        lastUpdate: 0
                    };
                }
                
                // 初始化可视化器
                if(!room.memory.visualizer) {
                    room.memory.visualizer = { 
                        enabled: true,
                        lastUpdate: 0
                    };
                }
            }
        }
    },

    // 初始化能源状态
    initEnergyStatus: function(room) {
        // 初始化能源状态
        if (!room.memory.energyStatus) {
            const energyUtils = require('energyUtils');
            room.memory.energyStatus = {
                currentStatus: 'normal',
                lastStatusChange: Game.time,
                energyLevel: room.energyAvailable / room.energyCapacityAvailable,
                harvestPositions: energyUtils.countHarvestPositions(room)
            };
        }
    }
};

module.exports = memoryManager; 