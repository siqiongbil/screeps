 /**
 * CPU管理工具模块
 * 提供CPU使用监控、优化和分配功能
 */
 module.exports = {
    // CPU使用统计
    stats: {
        systems: {},
        rooms: {},
        roles: {},
        lastReset: 0
    },
    
    // 初始化
    init: function() {
        if(!Memory.cpu) {
            Memory.cpu = {
                stats: {
                    systems: {},
                    rooms: {},
                    roles: {}
                },
                limits: {
                    systems: {},
                    rooms: {},
                    roles: {}
                },
                lastReset: Game.time
            };
        }
        
        // 每10000个tick重置统计
        if(Game.time - Memory.cpu.lastReset > 10000) {
            Memory.cpu.stats = {
                systems: {},
                rooms: {},
                roles: {}
            };
            Memory.cpu.lastReset = Game.time;
        }
    },
    
    // 开始测量CPU使用
    startMeasure: function() {
        this.startCpu = Game.cpu.getUsed();
        return this.startCpu;
    },
    
    // 结束测量并记录系统CPU使用
    endMeasure: function(systemName) {
        const used = Game.cpu.getUsed() - this.startCpu;
        
        if(!Memory.cpu.stats.systems[systemName]) {
            Memory.cpu.stats.systems[systemName] = {
                calls: 0,
                totalCpu: 0,
                maxCpu: 0
            };
        }
        
        Memory.cpu.stats.systems[systemName].calls++;
        Memory.cpu.stats.systems[systemName].totalCpu += used;
        Memory.cpu.stats.systems[systemName].maxCpu = Math.max(Memory.cpu.stats.systems[systemName].maxCpu, used);
        
        return used;
    },
    
    // 记录房间CPU使用
    recordRoomCpu: function(roomName, used) {
        if(!Memory.cpu.stats.rooms[roomName]) {
            Memory.cpu.stats.rooms[roomName] = {
                calls: 0,
                totalCpu: 0,
                maxCpu: 0
            };
        }
        
        Memory.cpu.stats.rooms[roomName].calls++;
        Memory.cpu.stats.rooms[roomName].totalCpu += used;
        Memory.cpu.stats.rooms[roomName].maxCpu = Math.max(Memory.cpu.stats.rooms[roomName].maxCpu, used);
    },
    
    // 记录角色CPU使用
    recordRoleCpu: function(role, used) {
        if(!Memory.cpu.stats.roles[role]) {
            Memory.cpu.stats.roles[role] = {
                calls: 0,
                totalCpu: 0,
                maxCpu: 0
            };
        }
        
        Memory.cpu.stats.roles[role].calls++;
        Memory.cpu.stats.roles[role].totalCpu += used;
        Memory.cpu.stats.roles[role].maxCpu = Math.max(Memory.cpu.stats.roles[role].maxCpu, used);
    },
    
    // 检查是否应该运行非必要系统
    shouldRunNonEssentialSystems: function() {
        // 如果CPU bucket低于1000，只运行必要系统
        if(Game.cpu.bucket < 1000) return false;
        
        // 如果CPU bucket低于3000，每3个tick运行一次非必要系统
        if(Game.cpu.bucket < 3000) return Game.time % 3 === 0;
        
        // 如果CPU bucket低于5000，每2个tick运行一次非必要系统
        if(Game.cpu.bucket < 5000) return Game.time % 2 === 0;
        
        // CPU bucket充足，每个tick都运行
        return true;
    },
    
    // 检查是否应该运行特定系统
    shouldRunSystem: function(systemName, priority = 'medium') {
        // 高优先级系统总是运行
        if(priority === 'high') return true;
        
        // 中优先级系统在bucket足够时运行
        if(priority === 'medium') {
            return this.shouldRunNonEssentialSystems();
        }
        
        // 低优先级系统在bucket充足时运行
        if(priority === 'low') {
            // 如果bucket低于5000，每5个tick运行一次
            if(Game.cpu.bucket < 5000) return Game.time % 5 === 0;
            
            // 如果bucket低于8000，每3个tick运行一次
            if(Game.cpu.bucket < 8000) return Game.time % 3 === 0;
            
            // bucket充足，每2个tick运行一次
            return Game.time % 2 === 0;
        }
        
        return false;
    },
    
    // 生成CPU使用报告
    generateReport: function() {
        let report = '===== CPU使用报告 =====\n';
        
        // 总体CPU使用
        report += `总CPU限制: ${Game.cpu.limit}\n`;
        report += `当前使用: ${Game.cpu.getUsed().toFixed(2)}\n`;
        report += `Bucket: ${Game.cpu.bucket}/10000\n\n`;
        
        // 系统CPU使用
        report += '系统CPU使用:\n';
        const systems = Memory.cpu.stats.systems;
        for(let systemName in systems) {
            const avgCpu = systems[systemName].totalCpu / systems[systemName].calls;
            report += `${systemName}: ${avgCpu.toFixed(2)}ms (最大: ${systems[systemName].maxCpu.toFixed(2)}ms, 调用: ${systems[systemName].calls})\n`;
        }
        
        // 房间CPU使用
        report += '\n房间CPU使用:\n';
        const rooms = Memory.cpu.stats.rooms;
        for(let roomName in rooms) {
            const avgCpu = rooms[roomName].totalCpu / rooms[roomName].calls;
            report += `${roomName}: ${avgCpu.toFixed(2)}ms (最大: ${rooms[roomName].maxCpu.toFixed(2)}ms)\n`;
        }
        
        // 角色CPU使用
        report += '\n角色CPU使用:\n';
        const roles = Memory.cpu.stats.roles;
        for(let role in roles) {
            const avgCpu = roles[role].totalCpu / roles[role].calls;
            report += `${role}: ${avgCpu.toFixed(2)}ms (最大: ${roles[role].maxCpu.toFixed(2)}ms, 调用: ${roles[role].calls})\n`;
        }
        
        return report;
    },
    
    // 运行CPU管理
    run: function() {
        this.init();
        
        // 每1000个tick生成一次报告
        if(Game.time % 1000 === 0) {
            console.log(this.generateReport());
        }
    }
};