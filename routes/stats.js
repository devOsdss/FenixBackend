const express = require('express');
const Lead = require('../models/Lead');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Get detailed leads statistics
router.get('/leads/detailed', authenticateToken, async (req, res) => {
  try {
    // Get total count of leads (including hidden)
    const totalLeads = await Lead.countDocuments({});
    
    // Get count of leads with status DUPLICATE
    const duplicateLeads = await Lead.countDocuments({ 
      status: 'DUPLICATE' 
    });
    
    // Get count of leads with department = 9
    const department9Leads = await Lead.countDocuments({ 
      department: '9' 
    });
    
    // Get count of leads with status CONVERTED
    const convertedLeads = await Lead.countDocuments({ 
      status: 'CONVERTED' 
    });
    
    // Calculate percentages
    const duplicatePercentage = totalLeads > 0 ? ((duplicateLeads / totalLeads) * 100).toFixed(2) : 0;
    const convertedPercentage = totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(2) : 0;
    
    res.json({
      success: true,
      data: {
        totalLeads,
        duplicateLeads,
        duplicatePercentage: parseFloat(duplicatePercentage),
        department9Leads,
        convertedLeads,
        convertedPercentage: parseFloat(convertedPercentage)
      }
    });

  } catch (error) {
    console.error('Get detailed stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка при отриманні детальної статистики',
      error: error.message
    });
  }
});

// Get leads overview statistics (basic stats)
router.get('/leads/overview', authenticateToken, async (req, res) => {
  try {
    const stats = await Lead.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const total = await Lead.countDocuments({});
    
    res.json({
      success: true,
      data: {
        total,
        byStatus: stats.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {})
      }
    });

  } catch (error) {
    console.error('Get overview stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка при отриманні загальної статистики',
      error: error.message
    });
  }
});

// Get leads count by status for filter buttons
router.get('/leads/status-counts', authenticateToken, async (req, res) => {
  try {
    // Get counts by status
    const statusCounts = await Lead.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Get total count
    const total = await Lead.countDocuments({});
    
    // Format response for filter buttons
    const counts = {
      '': total, // 'All' filter
    };
    
    statusCounts.forEach(item => {
      if (item._id) {
        counts[item._id] = item.count;
      }
    });
    
    res.json({
      success: true,
      data: counts
    });

  } catch (error) {
    console.error('Get status counts error:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка при отриманні кількості лідів',
      error: error.message
    });
  }
});

// Get leads statistics by sourceDescription
router.get('/leads/by-source-description', authenticateToken, async (req, res) => {
  try {
    // Get total leads count by sourceDescription
    const leadsBySource = await Lead.aggregate([
      {
        $group: {
          _id: '$sourceDescription',
          totalCount: { $sum: 1 },
          duplicateCount: {
            $sum: {
              $cond: [{ $eq: ['$status', 'DUPLICATE'] }, 1, 0]
            }
          }
        }
      },
      {
        $sort: { totalCount: -1 }
      }
    ]);

    // Calculate percentages and format data
    const totalLeads = await Lead.countDocuments({});
    const formattedData = leadsBySource.map(item => {
      const duplicatePercentage = item.totalCount > 0 
        ? ((item.duplicateCount / item.totalCount) * 100).toFixed(2) 
        : 0;
      const totalPercentage = totalLeads > 0 
        ? ((item.totalCount / totalLeads) * 100).toFixed(2) 
        : 0;
      
      return {
        sourceDescription: item._id || 'Не вказано',
        totalCount: item.totalCount,
        duplicateCount: item.duplicateCount,
        duplicatePercentage: parseFloat(duplicatePercentage),
        totalPercentage: parseFloat(totalPercentage)
      };
    });

    res.json({
      success: true,
      data: {
        totalLeads,
        bySourceDescription: formattedData
      }
    });

  } catch (error) {
    console.error('Get source description stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка при отриманні статистики по джерелах',
      error: error.message
    });
  }
});

// Get leads statistics by utm_source
router.get('/leads/by-utm-source', authenticateToken, async (req, res) => {
  try {
    // Get total leads count by utm_source
    const leadsByUtmSource = await Lead.aggregate([
      {
        $group: {
          _id: '$utm_source',
          totalCount: { $sum: 1 },
          duplicateCount: {
            $sum: {
              $cond: [{ $eq: ['$status', 'DUPLICATE'] }, 1, 0]
            }
          }
        }
      },
      {
        $sort: { totalCount: -1 }
      }
    ]);

    // Calculate percentages and format data
    const totalLeads = await Lead.countDocuments({});
    const formattedData = leadsByUtmSource.map(item => {
      const duplicatePercentage = item.totalCount > 0 
        ? ((item.duplicateCount / item.totalCount) * 100).toFixed(2) 
        : 0;
      const totalPercentage = totalLeads > 0 
        ? ((item.totalCount / totalLeads) * 100).toFixed(2) 
        : 0;
      
      return {
        utmSource: item._id || 'Не вказано',
        totalCount: item.totalCount,
        duplicateCount: item.duplicateCount,
        duplicatePercentage: parseFloat(duplicatePercentage),
        totalPercentage: parseFloat(totalPercentage)
      };
    });

    res.json({
      success: true,
      data: {
        totalLeads,
        byUtmSource: formattedData
      }
    });

  } catch (error) {
    console.error('Get utm source stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка при отриманні статистики по UTM джерелах',
      error: error.message
    });
  }
});

// Get leads statistics by manager
router.get('/leads/by-manager', authenticateToken, async (req, res) => {
  try {
    // Get leads count and status breakdown by manager
    const leadsByManager = await Lead.aggregate([
      {
        $group: {
          _id: {
            manager: '$manager',
            status: '$status'
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.manager',
          totalCount: { $sum: '$count' },
          statusBreakdown: {
            $push: {
              status: '$_id.status',
              count: '$count'
            }
          }
        }
      },
      {
        $sort: { totalCount: -1 }
      }
    ]);

    // Format data with status breakdown
    const totalLeads = await Lead.countDocuments({});
    const formattedData = leadsByManager.map(item => {
      const statusObj = {};
      let convertedCount = 0;
      let duplicateCount = 0;
      
      item.statusBreakdown.forEach(status => {
        statusObj[status.status || 'Не вказано'] = status.count;
        if (status.status === 'CONVERTED') convertedCount = status.count;
        if (status.status === 'DUPLICATE') duplicateCount = status.count;
      });
      
      const conversionRate = item.totalCount > 0 
        ? ((convertedCount / item.totalCount) * 100).toFixed(2) 
        : 0;
      const duplicateRate = item.totalCount > 0 
        ? ((duplicateCount / item.totalCount) * 100).toFixed(2) 
        : 0;
      const totalPercentage = totalLeads > 0 
        ? ((item.totalCount / totalLeads) * 100).toFixed(2) 
        : 0;
      
      return {
        manager: item._id || 'Не призначено',
        totalCount: item.totalCount,
        convertedCount,
        duplicateCount,
        conversionRate: parseFloat(conversionRate),
        duplicateRate: parseFloat(duplicateRate),
        totalPercentage: parseFloat(totalPercentage),
        statusBreakdown: statusObj
      };
    });

    res.json({
      success: true,
      data: {
        totalLeads,
        byManager: formattedData
      }
    });

  } catch (error) {
    console.error('Get manager stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка при отриманні статистики по менеджерах',
      error: error.message
    });
  }
});

// Get leads statistics by team
router.get('/leads/by-team', authenticateToken, async (req, res) => {
  try {
    // Get leads count by team
    const leadsByTeam = await Lead.aggregate([
      {
        $group: {
          _id: '$team',
          totalCount: { $sum: 1 },
          convertedCount: {
            $sum: {
              $cond: [{ $eq: ['$status', 'CONVERTED'] }, 1, 0]
            }
          },
          duplicateCount: {
            $sum: {
              $cond: [{ $eq: ['$status', 'DUPLICATE'] }, 1, 0]
            }
          }
        }
      },
      {
        $sort: { totalCount: -1 }
      }
    ]);

    // Calculate percentages and format data
    const totalLeads = await Lead.countDocuments({});
    const formattedData = leadsByTeam.map(item => {
      const conversionRate = item.totalCount > 0 
        ? ((item.convertedCount / item.totalCount) * 100).toFixed(2) 
        : 0;
      const duplicateRate = item.totalCount > 0 
        ? ((item.duplicateCount / item.totalCount) * 100).toFixed(2) 
        : 0;
      const totalPercentage = totalLeads > 0 
        ? ((item.totalCount / totalLeads) * 100).toFixed(2) 
        : 0;
      
      return {
        team: item._id || 'Не призначено',
        totalCount: item.totalCount,
        convertedCount: item.convertedCount,
        duplicateCount: item.duplicateCount,
        conversionRate: parseFloat(conversionRate),
        duplicateRate: parseFloat(duplicateRate),
        totalPercentage: parseFloat(totalPercentage)
      };
    });

    res.json({
      success: true,
      data: {
        totalLeads,
        byTeam: formattedData
      }
    });

  } catch (error) {
    console.error('Get team stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка при отриманні статистики по командах',
      error: error.message
    });
  }
});

// Get leads statistics by sourceDescription (only leads count)
router.get('/leads/source-description-leads', authenticateToken, async (req, res) => {
  try {
    const leadsBySource = await Lead.aggregate([
      {
        $group: {
          _id: '$sourceDescription',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    const totalLeads = await Lead.countDocuments({});
    const formattedData = leadsBySource.map(item => ({
      sourceDescription: item._id || 'Не указано',
      count: item.count,
      percentage: totalLeads > 0 ? ((item.count / totalLeads) * 100).toFixed(2) : 0
    }));

    res.json({
      success: true,
      data: {
        totalLeads,
        sources: formattedData
      }
    });
  } catch (error) {
    console.error('Get source description leads error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении статистики лидов по источникам',
      error: error.message
    });
  }
});

// Get leads statistics by utm_source (only leads count)
router.get('/leads/utm-source-leads', authenticateToken, async (req, res) => {
  try {
    const leadsByUtm = await Lead.aggregate([
      {
        $group: {
          _id: '$utm_source',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    const totalLeads = await Lead.countDocuments({});
    const formattedData = leadsByUtm.map(item => ({
      utmSource: item._id || 'Не указано',
      count: item.count,
      percentage: totalLeads > 0 ? ((item.count / totalLeads) * 100).toFixed(2) : 0
    }));

    res.json({
      success: true,
      data: {
        totalLeads,
        utmSources: formattedData
      }
    });
  } catch (error) {
    console.error('Get utm source leads error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении статистики лидов по UTM источникам',
      error: error.message
    });
  }
});

// Get duplicates statistics by sourceDescription
router.get('/leads/source-description-duplicates', authenticateToken, async (req, res) => {
  try {
    const duplicatesBySource = await Lead.aggregate([
      {
        $match: { 
          status: 'DUPLICATE'
        }
      },
      {
        $group: {
          _id: '$sourceDescription',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    const totalDuplicates = await Lead.countDocuments({ 
      status: 'DUPLICATE'
    });
    
    const formattedData = duplicatesBySource.map(item => ({
      sourceDescription: item._id || 'Не указано',
      count: item.count,
      percentage: totalDuplicates > 0 ? ((item.count / totalDuplicates) * 100).toFixed(2) : 0
    }));

    res.json({
      success: true,
      data: {
        totalDuplicates,
        sources: formattedData
      }
    });
  } catch (error) {
    console.error('Get source description duplicates error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении статистики дубликатов по источникам',
      error: error.message
    });
  }
});

// Get duplicates statistics by utm_source
router.get('/leads/utm-source-duplicates', authenticateToken, async (req, res) => {
  try {
    const duplicatesByUtm = await Lead.aggregate([
      {
        $match: { 
          status: 'DUPLICATE'
        }
      },
      {
        $group: {
          _id: '$utm_source',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    const totalDuplicates = await Lead.countDocuments({ 
      status: 'DUPLICATE'
    });
    
    const formattedData = duplicatesByUtm.map(item => ({
      utmSource: item._id || 'Не указано',
      count: item.count,
      percentage: totalDuplicates > 0 ? ((item.count / totalDuplicates) * 100).toFixed(2) : 0
    }));

    res.json({
      success: true,
      data: {
        totalDuplicates,
        utmSources: formattedData
      }
    });
  } catch (error) {
    console.error('Get utm source duplicates error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении статистики дубликатов по UTM источникам',
      error: error.message
    });
  }
});

// Get team status breakdown by team selector
router.get('/leads/team-status-breakdown/:teamName', authenticateToken, async (req, res) => {
  try {
    const { teamName } = req.params;
    
    const teamStats = await Lead.aggregate([
      {
        $match: { 
          team: teamName
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    const totalTeamLeads = await Lead.countDocuments({ 
      team: teamName
    });
    
    const formattedData = teamStats.map(item => ({
      status: item._id || 'Не указан',
      count: item.count,
      percentage: totalTeamLeads > 0 ? ((item.count / totalTeamLeads) * 100).toFixed(2) : 0
    }));

    res.json({
      success: true,
      data: {
        teamName,
        totalLeads: totalTeamLeads,
        statusBreakdown: formattedData
      }
    });
  } catch (error) {
    console.error('Get team status breakdown error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении разбивки по статусам команды',
      error: error.message
    });
  }
});

// Get UTM source status breakdown by UTM selector
router.get('/leads/utm-status-breakdown/:utmSource', authenticateToken, async (req, res) => {
  try {
    const { utmSource } = req.params;
    
    const utmStats = await Lead.aggregate([
      {
        $match: { 
          utm_source: utmSource
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    const totalUtmLeads = await Lead.countDocuments({ 
      utm_source: utmSource
    });
    
    const formattedData = utmStats.map(item => ({
      status: item._id || 'Не указан',
      count: item.count,
      percentage: totalUtmLeads > 0 ? ((item.count / totalUtmLeads) * 100).toFixed(2) : 0
    }));

    res.json({
      success: true,
      data: {
        utmSource,
        totalLeads: totalUtmLeads,
        statusBreakdown: formattedData
      }
    });
  } catch (error) {
    console.error('Get UTM status breakdown error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении разбивки по статусам UTM источника',
      error: error.message
    });
  }
});

// Get source description status breakdown by source selector
router.get('/leads/source-status-breakdown/:sourceDescription', authenticateToken, async (req, res) => {
  try {
    const { sourceDescription } = req.params;
    
    const sourceStats = await Lead.aggregate([
      {
        $match: { 
          sourceDescription: sourceDescription
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    const totalSourceLeads = await Lead.countDocuments({ 
      sourceDescription: sourceDescription
    });
    
    const formattedData = sourceStats.map(item => ({
      status: item._id || 'Не указан',
      count: item.count,
      percentage: totalSourceLeads > 0 ? ((item.count / totalSourceLeads) * 100).toFixed(2) : 0
    }));

    res.json({
      success: true,
      data: {
        sourceDescription,
        totalLeads: totalSourceLeads,
        statusBreakdown: formattedData
      }
    });
  } catch (error) {
    console.error('Get source status breakdown error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении разбивки по статусам источника',
      error: error.message
    });
  }
});

// Get all teams list for selector
router.get('/leads/teams-list', authenticateToken, async (req, res) => {
  try {
    const teams = await Lead.distinct('team');
    const filteredTeams = teams.filter(team => team && team !== null);
    
    res.json({
      success: true,
      data: filteredTeams
    });
  } catch (error) {
    console.error('Get teams list error:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при получении списка команд',
      error: error.message
    });
  }
});

// Get all UTM sources list for selector
router.get('/leads/utm-sources-list', authenticateToken, async (req, res) => {
  try {
    const utmSources = await Lead.distinct('utm_source');
    const filteredSources = utmSources.filter(source => source && source !== null && source !== '');
    
    res.json({
      success: true,
      data: filteredSources.sort()
    });
  } catch (error) {
    console.error('Get UTM sources list error:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка при отриманні списку UTM джерел',
      error: error.message
    });
  }
});

// Get all source descriptions list for selector
router.get('/leads/source-descriptions-list', authenticateToken, async (req, res) => {
  try {
    const sourceDescriptions = await Lead.distinct('sourceDescription');
    const filteredSources = sourceDescriptions.filter(source => source && source !== null && source !== '');
    
    res.json({
      success: true,
      data: filteredSources.sort()
    });
  } catch (error) {
    console.error('Get source descriptions list error:', error);
    res.status(500).json({
      success: false,
      message: 'Помилка при отриманні списку джерел',
      error: error.message
    });
  }
});

module.exports = router;
