const { Types } = require('mongoose');

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
 * Build filter object based on query parameters
 * @param {Object} query - Request query parameters
 * @returns {Object} MongoDB filter object
 */
async function buildLeadsFilter(query) {
  const { 
    status, 
    assigned, 
    search,
    hidden,
    department,
    sourceDescription,
    utm_source,
    dateFrom,
    dateTo,
    userRole,
    userTeam,
    userId
  } = query;

  const filter = {};
  
  // Hidden filter
  if (hidden !== undefined) {
    filter.hidden = hidden === 'true';
  }

  // Role-based filtering
  if (userRole && userId) {
    console.log('🔍 Role-based filtering:', { userRole, userId, userTeam });
    
    if (userRole === 'Manager' || userRole === 'Reten') {
      // Manager/Reten can only see leads assigned to them
      filter.assigned = userId;
      console.log('👤 Manager/Reten filter applied:', filter.assigned);
    } else if (userRole === 'TeamLead' && userTeam) {
      try {
        const Admin = require('../models/Admin');
        console.log('🔎 Looking for team members in team:', userTeam);
        
        const teamMembers = await Admin.find({ team: userTeam }, '_id login team');
        console.log('👥 Found team members:', teamMembers);
        
        const teamMemberIds = teamMembers.map(admin => admin._id.toString());
        teamMemberIds.push(userId); // Include TeamLead's own leads
        
        console.log('📋 Team member IDs (including TeamLead):', teamMemberIds);
        filter.assigned = { $in: teamMemberIds };
      } catch (error) {
        console.error('❌ Error fetching team members:', error);
        // Fallback to showing only own leads
        filter.assigned = userId;
      }
    }
  }
  
  // Advanced status handling: statusMode + statuses
  const { statusMode, statuses } = query;
  if (statusMode && typeof statuses === 'string' && statuses.trim().length > 0) {
    const list = statuses.split(',').map(s => s.trim()).filter(Boolean);
    if (statusMode === 'other') {
      filter.status = { $nin: list };
    } else if (statusMode === 'only') {
      filter.status = { $in: list };
    }
  } else if (status) {
    if (Array.isArray(status)) {
      filter.status = { $in: status };
    } else if (typeof status === 'string' && status.includes(',')) {
      const statusArray = status.split(',');
      filter.status = { $in: statusArray };
    } else {
      filter.status = status;
    }
  }

  // Assigned filter - for TeamLead, intersect with team members
  if (assigned) {
    console.log('🎯 Processing assigned filter:', { assigned, userRole, hasExistingAssignedFilter: !!filter.assigned });
    
    if (userRole === 'TeamLead' && filter.assigned && filter.assigned.$in) {
      // For TeamLead, intersect assigned filter with team members
      let assignedIds = [];
      if (Array.isArray(assigned)) {
        assignedIds = assigned;
      } else if (typeof assigned === 'string' && assigned.includes(',')) {
        assignedIds = assigned.split(',').map(id => id.trim()).filter(Boolean);
      } else {
        assignedIds = [assigned];
      }
      
      // Intersect with team member IDs
      const teamMemberIds = filter.assigned.$in;
      const intersectedIds = assignedIds.filter(id => teamMemberIds.includes(id));
      
      console.log('🔄 TeamLead filter intersection:', {
        requestedIds: assignedIds,
        teamMemberIds,
        intersectedIds
      });
      
      if (intersectedIds.length > 0) {
        filter.assigned = { $in: intersectedIds };
      } else {
        // If no intersection, show no results
        filter.assigned = { $in: [] };
      }
    } else if (!filter.assigned) {
      // For other roles or when no role-based filtering was applied
      if (Array.isArray(assigned)) {
        filter.assigned = { $in: assigned };
      } else if (typeof assigned === 'string' && assigned.includes(',')) {
        filter.assigned = { $in: assigned.split(',').map(id => id.trim()).filter(Boolean) };
      } else {
        filter.assigned = assigned;
      }
      console.log('✅ Applied assigned filter for non-TeamLead:', filter.assigned);
    }
  }

  // Search filter
  if (search) {
    filter.$or = createPhoneSearchConditions(search);
  }

  // Department filter
  if (department) {
    filter.department = department;
  }

  // Source description filter - supports multiple sources
  if (sourceDescription) {
    console.log('📋 sourceDescription received:', sourceDescription, 'type:', typeof sourceDescription);
    let sources = [];
    
    // Handle both string and array formats
    if (typeof sourceDescription === 'string' && sourceDescription.trim() !== '') {
      sources = [sourceDescription];
    } else if (Array.isArray(sourceDescription) && sourceDescription.length > 0) {
      sources = sourceDescription.filter(s => s && s.trim() !== '');
    }
    
    console.log('📋 Parsed sources:', sources);
    
    if (sources.length > 0) {
      const sourceConditions = sources.flatMap(source => [
        { sourceDescription: { $regex: `^${escapeRegex(source)}`, $options: 'i' } }, // Exact start match
        { sourceDescription: source }, // Exact match
        { sourceDescription: { $regex: escapeRegex(source), $options: 'i' } } // Contains match
      ]);
      
      console.log('📋 Source conditions:', JSON.stringify(sourceConditions, null, 2));
      
      if (filter.$or) {
        // Combine with existing search conditions using $and
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
  }

  // UTM source filter
  if (utm_source) {
    filter.utm_source = utm_source;
  }

  // Date range filter
  if (dateFrom || dateTo) {
    filter.dateCreate = {};
    
    if (dateFrom) {
      try {
        const startDate = new Date(dateFrom);
        if (!isNaN(startDate.getTime())) {
          startDate.setHours(0, 0, 0, 0);
          filter.dateCreate.$gte = startDate;
        }
      } catch (error) {
        console.error('Invalid dateFrom:', dateFrom);
      }
    }
    
    if (dateTo) {
      try {
        const endDate = new Date(dateTo);
        if (!isNaN(endDate.getTime())) {
          endDate.setHours(23, 59, 59, 999);
          filter.dateCreate.$lte = endDate;
        }
      } catch (error) {
        console.error('Invalid dateTo:', dateTo);
      }
    }
    
    // Remove empty dateCreate filter if no valid dates
    if (Object.keys(filter.dateCreate).length === 0) {
      delete filter.dateCreate;
    }
  }

  console.log('🎯 Final filter object:', JSON.stringify(filter, null, 2));
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
