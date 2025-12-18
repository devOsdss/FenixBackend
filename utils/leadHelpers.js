const { Types } = require('mongoose');
const { createLogger } = require('./logger');

const logger = createLogger('LeadHelpers');

/**
 * Helper function to escape regex special characters
 * @param {string} string - String to escape
 * @returns {string} Escaped string
 */
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Helper function to create phone search conditions
 * @param {string} search - Search query
 * @returns {Array} Array of search conditions
 */
function createPhoneSearchConditions(search) {
  // Escape regex special characters in search string
  const escapedSearch = escapeRegex(search);
  
  // Normalize phone search query by removing all non-digit characters
  const normalizedSearch = search.replace(/\D/g, '');
  
  const searchConditions = [
    { name: { $regex: `^${escapedSearch}`, $options: 'i' } }, // Пошук по початку імені
    { email: { $regex: `^${escapedSearch}`, $options: 'i' } } // Пошук по початку email
  ];
  
  // Add phone search conditions
  if (normalizedSearch.length > 0) {
    // Primary search: normalized phone starting with the search digits
    searchConditions.push({ normalizedPhone: { $regex: `^${normalizedSearch}` } });
    
    // Secondary search: original phone field starting with search pattern
    searchConditions.push({ phone: { $regex: `^${escapedSearch}`, $options: 'i' } });
    
    // Also search for phone numbers that start with the pattern after common prefixes
    // Handle cases like +380, 380, 0 prefixes
    if (normalizedSearch.length >= 3) {
      const patterns = [];
      
      // If search starts with 380, also try with +380 and 0380
      if (normalizedSearch.startsWith('380')) {
        patterns.push(`^\\+${normalizedSearch}`);
        patterns.push(`^0${normalizedSearch.substring(3)}`);
      }
      // If search starts with 0, try without 0 and with +380
      else if (normalizedSearch.startsWith('0') && normalizedSearch.length > 3) {
        const withoutZero = normalizedSearch.substring(1);
        patterns.push(`^380${withoutZero}`);
        patterns.push(`^\\+380${withoutZero}`);
      }
      // For other patterns, try with common prefixes
      else {
        patterns.push(`^380${normalizedSearch}`);
        patterns.push(`^\\+380${normalizedSearch}`);
        patterns.push(`^0${normalizedSearch}`);
      }
      
      patterns.forEach(pattern => {
        searchConditions.push({ normalizedPhone: { $regex: pattern } });
        searchConditions.push({ phone: { $regex: pattern, $options: 'i' } });
      });
    }
  } else {
    // If no digits in search, search phone field starting with the pattern
    searchConditions.push({ phone: { $regex: `^${escapedSearch}`, $options: 'i' } });
  }
  
  return searchConditions;
}

/**
 * Apply role-based filtering
 * @private
 */
async function applyRoleBasedFilter(filter, { userRole, userId, userTeam }) {
  if (!userRole || !userId) return;

  logger.debug('Applying role-based filter', { userRole, userId, userTeam });

  // Team Fantom restriction: all members can only see their own leads
  if (userTeam === 'Team Fantom') {
    filter.assigned = userId;
    logger.debug('Applied Team Fantom restriction', { assigned: userId });
    return;
  }

  // Standard role-based filtering for other teams
  if (userRole === 'Manager' || userRole === 'Reten') {
    filter.assigned = userId;
    logger.debug('Applied Manager/Reten filter', { assigned: userId });
    return;
  }

  if (userRole === 'TeamLead' && userTeam) {
    try {
      const Admin = require('../models/Admin');
      const teamMembers = await Admin.find({ team: userTeam }, '_id').lean();
      
      const teamMemberIds = teamMembers.map(admin => admin._id.toString());
      teamMemberIds.push(userId);
      
      filter.assigned = { $in: teamMemberIds };
      logger.debug('Applied TeamLead filter', { teamSize: teamMemberIds.length });
    } catch (error) {
      logger.error('Failed to fetch team members', { error: error.message, userTeam });
      filter.assigned = userId; // Fallback
    }
  }
}

/**
 * Apply status filtering with advanced modes
 * @private
 */
function applyStatusFilter(filter, { status, statusMode, statuses }) {
  if (statusMode && typeof statuses === 'string' && statuses.trim().length > 0) {
    const list = statuses.split(',').map(s => s.trim()).filter(Boolean);
    if (statusMode === 'other') {
      filter.status = { $nin: list };
    } else if (statusMode === 'only') {
      filter.status = { $in: list };
    }
    return;
  }

  if (!status) return;

  if (Array.isArray(status)) {
    filter.status = { $in: status };
  } else if (typeof status === 'string' && status.includes(',')) {
    filter.status = { $in: status.split(',') };
  } else {
    filter.status = status;
  }
}

/**
 * Apply assigned filter with role intersection
 * @private
 */
function applyAssignedFilter(filter, assigned, userRole) {
  if (!assigned) return;

  logger.debug('Processing assigned filter', { assigned, userRole, hasExistingFilter: !!filter.assigned });

  let assignedIds = [];
  if (Array.isArray(assigned)) {
    assignedIds = assigned;
  } else if (typeof assigned === 'string' && assigned.includes(',')) {
    assignedIds = assigned.split(',').map(id => id.trim()).filter(Boolean);
  } else {
    assignedIds = [assigned];
  }

  // For TeamLead, intersect with existing team filter
  if (userRole === 'TeamLead' && filter.assigned && filter.assigned.$in) {
    const teamMemberIds = filter.assigned.$in;
    const intersectedIds = assignedIds.filter(id => teamMemberIds.includes(id));
    
    logger.debug('TeamLead filter intersection', {
      requestedIds: assignedIds.length,
      teamMemberIds: teamMemberIds.length,
      intersectedIds: intersectedIds.length
    });
    
    filter.assigned = intersectedIds.length > 0 ? { $in: intersectedIds } : { $in: [] };
  } else if (!filter.assigned) {
    filter.assigned = assignedIds.length === 1 ? assignedIds[0] : { $in: assignedIds };
  }
}

/**
 * Apply search filter for name, email, and phone
 * @private
 */
function applySearchFilter(filter, search) {
  if (!search) return;
  filter.$or = createPhoneSearchConditions(search);
}

/**
 * Apply source description filter with optimized regex
 * @private
 */
function applySourceFilter(filter, sourceDescription) {
  if (!sourceDescription) return;

  logger.debug('Applying source filter', { sourceDescription, type: typeof sourceDescription });

  let sources = [];
  if (typeof sourceDescription === 'string' && sourceDescription.trim() !== '') {
    sources = [sourceDescription];
  } else if (Array.isArray(sourceDescription) && sourceDescription.length > 0) {
    sources = sourceDescription.filter(s => s && s.trim() !== '');
  }

  if (sources.length === 0) return;

  // Optimized: single regex per source instead of 3
  const sourceConditions = sources.map(source => ({
    sourceDescription: { $regex: escapeRegex(source), $options: 'i' }
  }));

  if (filter.$or) {
    // Combine with existing search conditions
    const searchConditions = filter.$or;
    delete filter.$or;
    filter.$and = [
      { $or: searchConditions },
      { $or: sourceConditions }
    ];
  } else {
    filter.$or = sourceConditions;
  }
}

/**
 * Apply team filter by finding team members
 * Supports both new Teams collection and legacy team field in Admin
 * @private
 */
async function applyTeamFilter(filter, team) {
  if (!team) return;

  try {
    const Team = require('../models/Teams');
    const Admin = require('../models/Admin');
    const { Types } = require('mongoose');
    
    // Handle multiple teams
    const teamIds = Array.isArray(team) ? team : [team];
    logger.debug('Processing team filter', { teamIds, count: teamIds.length });
    
    let teamMemberIds = [];
    
    // Check if all teamIds are valid ObjectIds
    const allValidObjectIds = teamIds.every(id => Types.ObjectId.isValid(id) && id.length === 24);
    
    if (allValidObjectIds) {
      // Try new Teams collection (ObjectId-based)
      logger.debug('Team IDs are valid ObjectIds, checking Teams collection');
      
      const teamDocs = await Team.find({ _id: { $in: teamIds } })
        .populate('leaderIds managerIds')
        .lean();

      if (teamDocs.length > 0) {
        // New system: collect team members from Teams collection
        const allTeamMemberIds = new Set();
        teamDocs.forEach(teamDoc => {
          teamDoc.leaderIds.forEach(leader => {
            const id = typeof leader._id === 'string' ? leader._id : leader._id.toString();
            allTeamMemberIds.add(id);
          });
          teamDoc.managerIds.forEach(manager => {
            const id = typeof manager._id === 'string' ? manager._id : manager._id.toString();
            allTeamMemberIds.add(id);
          });
        });
        teamMemberIds = Array.from(allTeamMemberIds);
        
        logger.debug('Found teams in Teams collection', { 
          teamsFound: teamDocs.length,
          memberCount: teamMemberIds.length,
          sampleIds: teamMemberIds.slice(0, 3)
        });
      }
    }
    
    // If no teams found in new system or IDs are not ObjectIds, try legacy system
    if (teamMemberIds.length === 0) {
      // Legacy system: find admins by team field (string)
      logger.debug('Using legacy team field (string-based)');
      
      const admins = await Admin.find({ team: { $in: teamIds } }, '_id').lean();
      teamMemberIds = admins.map(admin => {
        const id = typeof admin._id === 'string' ? admin._id : admin._id.toString();
        return id;
      });
      
      logger.debug('Found admins with legacy team field', { 
        adminCount: teamMemberIds.length,
        teams: teamIds,
        sampleIds: teamMemberIds.slice(0, 3)
      });
    }

    if (teamMemberIds.length === 0) {
      logger.warn('No team members found', { teamIds });
      filter.assigned = { $in: [] };
      return;
    }

    // Intersect with existing assigned filter if present
    if (filter.assigned) {
      if (filter.assigned.$in) {
        const intersectedIds = filter.assigned.$in.filter(id => 
          teamMemberIds.includes(id.toString())
        );
        filter.assigned = { $in: intersectedIds };
      } else {
        const assignedId = filter.assigned.toString();
        filter.assigned = teamMemberIds.includes(assignedId) ? assignedId : { $in: [] };
      }
    } else {
      filter.assigned = { $in: teamMemberIds };
    }

    logger.debug('Applied team filter', { 
      teamIds, 
      memberCount: teamMemberIds.length 
    });
  } catch (error) {
    logger.error('Failed to apply team filter', { error: error.message, teamId: team });
    filter.assigned = { $in: [] };
  }
}

/**
 * Apply date range filter
 * Frontend sends dates in ISO format from user's local timezone.
 * We use the date as-is to match the user's local day.
 * @private
 */
function applyDateFilter(filter, { dateFrom, dateTo }) {
  if (!dateFrom && !dateTo) return;

  filter.dateCreate = {};

  if (dateFrom) {
    try {
      // Use the date as sent from frontend (already in ISO format with timezone)
      const startDate = new Date(dateFrom);
      if (!isNaN(startDate.getTime())) {
        filter.dateCreate.$gte = startDate;
        logger.info('Date filter applied', { 
          dateFrom, 
          startDate: startDate.toISOString() 
        });
      }
    } catch (error) {
      logger.warn('Invalid dateFrom', { dateFrom, error: error.message });
    }
  }

  if (dateTo) {
    try {
      // Use the date as sent from frontend, but set to end of day
      const endDate = new Date(dateTo);
      if (!isNaN(endDate.getTime())) {
        // Add 24 hours minus 1ms to get end of day in the same timezone
        endDate.setTime(endDate.getTime() + (24 * 60 * 60 * 1000) - 1);
        filter.dateCreate.$lte = endDate;
        logger.info('Date filter applied', { 
          dateTo, 
          endDate: endDate.toISOString() 
        });
      }
    } catch (error) {
      logger.warn('Invalid dateTo', { dateTo, error: error.message });
    }
  }

  // Remove empty dateCreate filter
  if (Object.keys(filter.dateCreate).length === 0) {
    delete filter.dateCreate;
  }
}

/**
 * Build filter object based on query parameters
 * @param {Object} query - Request query parameters
 * @returns {Promise<Object>} MongoDB filter object
 */
async function buildLeadsFilter(query) {
  const { 
    status, 
    assigned, 
    search,
    hidden,
    department,
    team,
    sourceDescription,
    utm_source,
    dateFrom,
    dateTo,
    userRole,
    userTeam,
    userId,
    statusMode,
    statuses,
    hasTeamLeadAssignedAt,
    teamLeadAssignedAtStart,
    teamLeadAssignedAtEnd
  } = query;

  const filter = {};
  
  // Apply basic filters
  if (hidden !== undefined) {
    filter.hidden = hidden === 'true';
  }

  if (department) {
    filter.department = department;
  }

  if (utm_source) {
    filter.utm_source = utm_source;
  }

  // Filter by teamLeadAssignedAt
  if (hasTeamLeadAssignedAt === 'true' || hasTeamLeadAssignedAt === true) {
    filter.teamLeadAssignedAt = { $exists: true, $ne: null };
  }

  // Filter by teamLeadAssignedAt date range
  if (teamLeadAssignedAtStart || teamLeadAssignedAtEnd) {
    filter.teamLeadAssignedAt = filter.teamLeadAssignedAt || {};
    
    if (teamLeadAssignedAtStart) {
      const startDate = new Date(teamLeadAssignedAtStart);
      filter.teamLeadAssignedAt.$gte = startDate;
    }
    
    if (teamLeadAssignedAtEnd) {
      const endDate = new Date(teamLeadAssignedAtEnd);
      endDate.setTime(endDate.getTime() + (24 * 60 * 60 * 1000) - 1);
      filter.teamLeadAssignedAt.$lte = endDate;
    }
  }

  // Apply complex filters in order
  await applyRoleBasedFilter(filter, { userRole, userId, userTeam });
  applyStatusFilter(filter, { status, statusMode, statuses });
  applyAssignedFilter(filter, assigned, userRole);
  applySearchFilter(filter, search);
  applySourceFilter(filter, sourceDescription);
  await applyTeamFilter(filter, team);
  applyDateFilter(filter, { dateFrom, dateTo });

  logger.debug('Built filter object', { filterKeys: Object.keys(filter) });
  return filter;
}

/**
 * Build sort object based on query parameters
 * @param {Object} query - Request query parameters
 * @returns {Object} MongoDB sort object
 */
function buildSortObject(query) {
  const { sortBy = 'dateCreate', sortOrder = 'desc' } = query;
  const sort = {};
  sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
  return sort;
}

/**
 * Validate ObjectId
 * @param {string} id - ID to validate
 * @returns {boolean} True if valid ObjectId
 */
function isValidObjectId(id) {
  return Types.ObjectId.isValid(id);
}

module.exports = {
  escapeRegex,
  createPhoneSearchConditions,
  buildLeadsFilter,
  buildSortObject,
  isValidObjectId
};
