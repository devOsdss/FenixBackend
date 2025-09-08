const express = require('express');
const router = express.Router();
const Team = require('../models/Teams');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');

// GET /api/teams - Get all teams with filtering and population
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { search, leaderId, managerId, sortBy = 'name', sortOrder = 'asc' } = req.query;
    
    // Build filter
    const filter = {};
    
    if (search) {
      filter.name = { $regex: search, $options: 'i' };
    }
    
    if (leaderId) {
      filter.leaderIds = leaderId;
    }
    
    if (managerId) {
      filter.managerIds = managerId;
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const teams = await Team.find(filter)
      .populate('leaderIds', 'login email role')
      .populate('managerIds', 'login email role')
      .sort(sort);
    
    res.json({
      success: true,
      data: teams,
      count: teams.length
    });
  } catch (error) {
    console.error('Error fetching teams:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка при отриманні команд',
      error: error.message
    });
  }
});

// GET /api/teams/:id - Get team by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const team = await Team.findById(req.params.id)
      .populate('leaderIds', 'login email role department')
      .populate('managerIds', 'login email role department');
    
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Команду не знайдено'
      });
    }
    
    res.json({
      success: true,
      data: team
    });
  } catch (error) {
    console.error('Error fetching team:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка при отриманні команди',
      error: error.message
    });
  }
});

// POST /api/teams - Create new team
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, leaderIds = [], managerIds = [] } = req.body;
    
    // Validation
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Название команды является обязательным'
      });
    }

    // Check if team with same name exists
    const existingTeam = await Team.findOne({ name: name.trim() });
    if (existingTeam) {
      return res.status(400).json({
        success: false,
        message: 'Команда з такою назвою вже існує'
      });
    }

    const team = new Team({
      name: name.trim(),
      leaderIds,
      managerIds
    });

    await team.save();
    
    // Populate and return the created team
    const populatedTeam = await Team.findById(team._id)
      .populate('leaderIds', 'login email role')
      .populate('managerIds', 'login email role');
    
    res.status(201).json({
      success: true,
      data: populatedTeam,
      message: 'Команду успішно створено'
    });
  } catch (error) {
    console.error('Error creating team:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка при створенні команди',
      error: error.message
    });
  }
});

// PUT /api/teams/:id - Update team
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { name, leaderIds, managerIds } = req.body;
    
    // Find team
    const team = await Team.findById(req.params.id);
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Команду не знайдено'
      });
    }

    // Validation
    if (name !== undefined) {
      if (!name || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Назва команди не може бути порожньою'
        });
      }
      
      // Check if another team with same name exists
      const existingTeam = await Team.findOne({ 
        name: name.trim(), 
        _id: { $ne: req.params.id } 
      });
      if (existingTeam) {
        return res.status(400).json({
          success: false,
          message: 'Команда з такою назвою вже існує'
        });
      }
      
      team.name = name.trim();
    }
    
    if (leaderIds !== undefined) {
      team.leaderIds = leaderIds;
    }
    
    if (managerIds !== undefined) {
      team.managerIds = managerIds;
    }

    await team.save();
    
    // Populate and return updated team
    const updatedTeam = await Team.findById(team._id)
      .populate('leaderIds', 'login email role')
      .populate('managerIds', 'login email role');
    
    res.json({
      success: true,
      data: updatedTeam,
      message: 'Команду успішно оновлено'
    });
  } catch (error) {
    console.error('Error updating team:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка при оновленні команди',
      error: error.message
    });
  }
});

// DELETE /api/teams/:id - Delete team
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Команду не знайдено'
      });
    }

    await Team.findByIdAndDelete(req.params.id);
    
    res.json({
      success: true,
      message: 'Команду успішно видалено'
    });
  } catch (error) {
    console.error('Error deleting team:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка при видаленні команди',
      error: error.message
    });
  }
});

// POST /api/teams/:id/leaders - Add leader to team
router.post('/:id/leaders', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId є обов\'язковим'
      });
    }
    
    const team = await Team.findById(req.params.id);
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Команду не знайдено'
      });
    }
    
    team.addLeader(userId);
    await team.save();
    
    const updatedTeam = await Team.findById(team._id)
      .populate('leaderIds', 'login email role')
      .populate('managerIds', 'login email role');
    
    res.json({
      success: true,
      data: updatedTeam,
      message: 'Лідера успішно додано'
    });
  } catch (error) {
    console.error('Error adding leader:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка при додаванні лідера',
      error: error.message
    });
  }
});

// DELETE /api/teams/:id/leaders/:userId - Remove leader from team
router.delete('/:id/leaders/:userId', authenticateToken, async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Команду не знайдено'
      });
    }
    
    team.removeLeader(req.params.userId);
    await team.save();
    
    const updatedTeam = await Team.findById(team._id)
      .populate('leaderIds', 'login email role')
      .populate('managerIds', 'login email role');
    
    res.json({
      success: true,
      data: updatedTeam,
      message: 'Лідера успішно видалено'
    });
  } catch (error) {
    console.error('Error removing leader:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка при видаленні лідера',
      error: error.message
    });
  }
});

// POST /api/teams/:id/managers - Add manager to team
router.post('/:id/managers', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId є обов\'язковим'
      });
    }
    
    const team = await Team.findById(req.params.id);
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Команду не знайдено'
      });
    }
    
    team.addManager(userId);
    await team.save();
    
    const updatedTeam = await Team.findById(team._id)
      .populate('leaderIds', 'login email role')
      .populate('managerIds', 'login email role');
    
    res.json({
      success: true,
      data: updatedTeam,
      message: 'Менеджера успішно додано'
    });
  } catch (error) {
    console.error('Error adding manager:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка при додаванні менеджера',
      error: error.message
    });
  }
});

// DELETE /api/teams/:id/managers/:userId - Remove manager from team
router.delete('/:id/managers/:userId', authenticateToken, async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) {
      return res.status(404).json({
        success: false,
        message: 'Команду не знайдено'
      });
    }
    
    team.removeManager(req.params.userId);
    await team.save();
    
    const updatedTeam = await Team.findById(team._id)
      .populate('leaderIds', 'login email role')
      .populate('managerIds', 'login email role');
    
    res.json({
      success: true,
      data: updatedTeam,
      message: 'Менеджера успішно видалено'
    });
  } catch (error) {
    console.error('Error removing manager:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка при видаленні менеджера',
      error: error.message
    });
  }
});

// GET /api/teams/user/:userId - Get teams by user (leader or manager)
router.get('/user/:userId', authenticateToken, async (req, res) => {
  try {
    const teams = await Team.findByUser(req.params.userId)
      .populate('leaderIds', 'login email role')
      .populate('managerIds', 'login email role')
      .sort({ name: 1 });
    
    res.json({
      success: true,
      data: teams,
      count: teams.length
    });
  } catch (error) {
    console.error('Error fetching user teams:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка при отриманні команд користувача',
      error: error.message
    });
  }
});

// POST /api/teams/bulk - Bulk operations
router.post('/bulk', authenticateToken, async (req, res) => {
  try {
    const { operation, ids, data } = req.body;
    
    if (!operation || !ids || !Array.isArray(ids)) {
      return res.status(400).json({
        success: false,
        message: 'Невірні параметри для bulk операції'
      });
    }

    let result;
    
    switch (operation) {
      case 'delete':
        result = await Team.deleteMany({ _id: { $in: ids } });
        res.json({
          success: true,
          message: `Видалено ${result.deletedCount} команд`,
          deletedCount: result.deletedCount
        });
        break;
        
      case 'addLeader':
        if (!data.userId) {
          return res.status(400).json({
            success: false,
            message: 'userId є обов\'язковим для додавання лідера'
          });
        }
        
        result = await Team.updateMany(
          { _id: { $in: ids } },
          { $addToSet: { leaderIds: data.userId } }
        );
        
        res.json({
          success: true,
          message: `Лідера додано до ${result.modifiedCount} команд`,
          modifiedCount: result.modifiedCount
        });
        break;
        
      case 'addManager':
        if (!data.userId) {
          return res.status(400).json({
            success: false,
            message: 'userId є обов\'язковим для додавання менеджера'
          });
        }
        
        result = await Team.updateMany(
          { _id: { $in: ids } },
          { $addToSet: { managerIds: data.userId } }
        );
        
        res.json({
          success: true,
          message: `Менеджера додано до ${result.modifiedCount} команд`,
          modifiedCount: result.modifiedCount
        });
        break;
        
      default:
        return res.status(400).json({
          success: false,
          message: 'Невідома операція'
        });
    }
  } catch (error) {
    console.error('Error in bulk operation:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка при виконанні bulk операції',
      error: error.message
    });
  }
});

module.exports = router;
