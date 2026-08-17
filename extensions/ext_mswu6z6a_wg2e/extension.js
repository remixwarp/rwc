(function(Scratch) {
  'use strict';

  class ListJsonConverter {
    getInfo() {
      return {
        id: 'listjsonconverter',
        name: '列表JSON转换器',
        color1: '#4a90e2',
        color2: '#357abd',
        blocks: [
          {
            opcode: 'listToJson',
            blockType: Scratch.BlockType.REPORTER,
            text: '列表 [LIST] 转换为JSON数组',
            arguments: {
              LIST: {
                type: Scratch.ArgumentType.STRING,
                menu: 'lists'
              }
            }
          },
          {
            opcode: 'jsonToList',
            blockType: Scratch.BlockType.COMMAND,
            text: '将JSON数组 [JSON] 转换为列表 [LIST]',
            arguments: {
              JSON: {
                type: Scratch.ArgumentType.STRING,
                defaultValue: '["item1", "item2", "item3"]'
              },
              LIST: {
                type: Scratch.ArgumentType.STRING,
                menu: 'lists'
              }
            }
          }
        ],
        menus: {
          lists: {
            acceptReporters: true,
            items: 'getLists'
          }
        }
      };
    }

    getLists() {
      const lists = [];
      if (Scratch.vm.runtime.targets) {
        const stage = Scratch.vm.runtime.targets[0];
        if (stage && stage.variables) {
          for (const varId in stage.variables) {
            const variable = stage.variables[varId];
            if (variable.type === 'list') {
              lists.push({
                text: variable.name,
                value: variable.id
              });
            }
          }
        }
        
        // 检查当前精灵的变量
        const currentTarget = Scratch.vm.runtime.getEditingTarget();
        if (currentTarget && currentTarget.variables) {
          for (const varId in currentTarget.variables) {
            const variable = currentTarget.variables[varId];
            if (variable.type === 'list') {
              // 避免重复添加
              if (!lists.some(list => list.value === variable.id)) {
                lists.push({
                  text: variable.name,
                  value: variable.id
                });
              }
            }
          }
        }
      }
      
      return lists.length > 0 ? lists : [{text: '无可用列表', value: ''}];
    }

    getListById(listId) {
      if (!listId) return null;
      
      // 在所有目标中查找列表
      for (const target of Scratch.vm.runtime.targets) {
        if (target && target.variables && target.variables[listId]) {
          const variable = target.variables[listId];
          if (variable.type === 'list') {
            return variable;
          }
        }
      }
      return null;
    }

    listToJson(args, util) {
      try {
        const list = this.getListById(args.LIST);
        if (!list) {
          return '[]';
        }
        
        // 获取列表内容并转换为JSON
        const listContents = list.value;
        return JSON.stringify(listContents);
      } catch (error) {
        console.error('列表转JSON错误:', error);
        return '[]';
      }
    }

    jsonToList(args, util) {
      try {
        // 解析JSON
        const jsonArray = JSON.parse(args.JSON);
        
        // 确保解析结果是数组
        if (!Array.isArray(jsonArray)) {
          throw new Error('JSON不是有效的数组');
        }
        
        // 获取目标列表
        const list = this.getListById(args.LIST);
        if (!list) {
          return;
        }
        
        // 清空原列表并添加新内容
        list.value = jsonArray.map(item => String(item));
      } catch (error) {
        console.error('JSON转列表错误:', error);
        // 如果解析失败，清空列表
        const list = this.getListById(args.LIST);
        if (list) {
          list.value = [];
        }
      }
    }
  }

  Scratch.extensions.register(new ListJsonConverter());
})(Scratch);
