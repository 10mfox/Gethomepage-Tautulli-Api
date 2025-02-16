// src/components/managers/utils/homepageConfig.js

const generateUserMappings = (length, formatFields) => {
  return Array.from({ length }, (_, index) => {
    const baseMapping = `               - field:
                   response:
                     data:
                       ${index}: field`;
    
    const hasAdditionalField = formatFields.users.some(f => f.id === 'additionalfield');
    const additionalFieldMapping = hasAdditionalField ? `
                 additionalField:
                   field:
                     response:
                       data:
                         ${index}: additionalfield` : '';
    
    return baseMapping + additionalFieldMapping;
  }).join('\n');
};

const generateMediaMappings = (length, hasAdditionalField = false) => {
  return Array.from({ length }, (_, index) => {
    const baseMapping = `            - field:
                response:
                  data:
                    ${index}: field`;
    
    const additionalFieldMapping = hasAdditionalField ? `
              additionalField:
                field:
                  response:
                    data:
                      ${index}: additionalfield
                color: theme` : '';
    
    return baseMapping + additionalFieldMapping;
  }).join('\n');
};

const generateActivityYaml = (formatFields, mappingLengths, localIp) => {
  const hasField = formatFields.users.some(f => f.id === 'field');
  
  if (!hasField) {
    return '';
  }

  const mappings = generateUserMappings(mappingLengths.users, formatFields);
  return `- Activity:                     
    - Activity:
         id: list
         widgets:
           - type: customapi
             url: http://${localIp}:3010/api/users
             method: GET
             display: list
             mappings:
${mappings}`;
};

const generateMediaCountSection = (sectionId, sectionName, index, isShow, localIp, useFormattedNumbers) => {
  const valueParam = useFormattedNumbers ? '_formatted' : '';
  const baseMapping = `             - field:
                 response:
                   sections:
                     ${index}: count${valueParam}
               format: numbers
               label: ${sectionName}`;

  const showMappings = isShow ? `
             - field:
                 response:
                   sections:
                     ${index}: parent_count${valueParam}
               format: numbers
               label: Seasons
             - field:
                 response:
                   sections:
                     ${index}: child_count${valueParam}
               format: numbers
               label: Episodes` : '';

  return `    - ${sectionName}:
         widgets:
           - type: customapi
             url: http://${localIp}:3010/api/libraries
             method: GET
             display: block
             mappings:
${baseMapping}${showMappings}`;
};

const generateRecentMediaYaml = (sections, formatFields, libraryNames, mappingLengths, localIp, combineSections = false) => {
  const yaml = [];
  
  if (combineSections) {
    if (sections.movies.length > 0) {
      const mappings = generateMediaMappings(mappingLengths.movies, true);
      yaml.push(`    - Movies:
        icon: mdi-filmstrip
        id: list
        widget:
          type: customapi
          url: http://${localIp}:3010/api/recent/movies?count=${mappingLengths.movies}
          method: GET
          display: list
          mappings:
${mappings}`);
    }

    if (sections.shows.length > 0) {
      const mappings = generateMediaMappings(mappingLengths.shows, true);
      yaml.push(`    - TV Shows:
        icon: mdi-television-classic
        id: list
        widget:
          type: customapi
          url: http://${localIp}:3010/api/recent/shows?count=${mappingLengths.shows}
          method: GET
          display: list
          mappings:
${mappings}`);
    }
  } else {
    if (sections.movies.length > 0) {
      sections.movies.forEach(sectionId => {
        const sectionFields = formatFields.movies[sectionId]?.fields || [];
        const hasField = sectionFields.some(f => f.id === 'field');
        const sectionName = libraryNames[sectionId] || `Movies Section ${sectionId}`;
        
        if (hasField) {
          const mappings = generateMediaMappings(mappingLengths.movies, sectionFields.some(f => f.id === 'additionalfield'));
          yaml.push(`    - ${sectionName}:
        icon: mdi-filmstrip
        id: list
        widget:
          type: customapi
          url: http://${localIp}:3010/api/recent/movies/${sectionId}?count=${mappingLengths.movies}
          method: GET
          display: list
          mappings:
${mappings}`);
        }
      });
    }

    if (sections.shows.length > 0) {
      sections.shows.forEach(sectionId => {
        const sectionFields = formatFields.shows[sectionId]?.fields || [];
        const hasField = sectionFields.some(f => f.id === 'field');
        const sectionName = libraryNames[sectionId] || `Shows Section ${sectionId}`;
        
        if (hasField) {
          const mappings = generateMediaMappings(mappingLengths.shows, sectionFields.some(f => f.id === 'additionalfield'));
          yaml.push(`    - ${sectionName}:
        icon: mdi-television-classic
        id: list
        widget:
          type: customapi
          url: http://${localIp}:3010/api/recent/shows/${sectionId}?count=${mappingLengths.shows}
          method: GET
          display: list
          mappings:
${mappings}`);
        }
      });
    }
  }

  return yaml.length > 0 ? `- Recently Added:\n${yaml.join('\n\n')}` : '';
};

const generateMediaCountYaml = (sections, libraryNames, localIp, showIndividualCounts, useFormattedNumbers) => {
  if (showIndividualCounts) {
    const yaml = [];

    // Add Movies sections
    if (sections.movies.length > 0) {
      sections.movies.forEach((sectionId, index) => {
        const sectionName = libraryNames[sectionId] || `Movies Section ${sectionId}`;
        yaml.push(generateMediaCountSection(sectionId, sectionName, index, false, localIp, useFormattedNumbers));
      });
    }

    // Add Shows sections
    if (sections.shows.length > 0) {
      sections.shows.forEach((sectionId, index) => {
        const sectionName = libraryNames[sectionId] || `Shows Section ${sectionId}`;
        const showIndex = sections.movies.length + index;
        yaml.push(generateMediaCountSection(sectionId, sectionName, showIndex, true, localIp, useFormattedNumbers));
      });
    }

    return `- Media Count:\n${yaml.join('\n\n')}`;
  } else {
    const valueParam = useFormattedNumbers ? '_formatted' : '';

    return `- Media Count:
    - Movies:
         widgets:
           - type: customapi
             url: http://${localIp}:3010/api/libraries
             method: GET
             display: block
             mappings:
             - field:
                 response:
                   totals:
                     movies: total_items${valueParam}
               format: numbers
               label: Movies

    - Shows:
         widgets:
           - type: customapi
             url: http://${localIp}:3010/api/libraries
             method: GET
             display: block
             mappings:
             - field:
                 response:
                   totals:
                     shows: total_items${valueParam}
               format: numbers
               label: Shows
             - field:
                 response:
                   totals:
                     shows: total_seasons${valueParam}
               format: numbers
               label: Seasons
             - field:
                 response:
                   totals:
                     shows: total_episodes${valueParam}
               format: numbers
               label: Episodes`;
  }
};

export {
  generateActivityYaml,
  generateRecentMediaYaml,
  generateMediaCountYaml
};