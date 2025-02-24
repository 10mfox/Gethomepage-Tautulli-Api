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
    const baseMapping = `              - field:
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

const generateRecentMediaYaml = (sections, formatFields, libraryNames, mappingLengths, localIp, combineSections = false, showCount = false, useFormattedNumbers = true) => {
  const yaml = [];
  const valueParam = useFormattedNumbers ? '_formatted' : '';
  
  if (sections.movies.length > 0 || sections.shows.length > 0) {
    if (combineSections) {
      // Combined movies section
      if (sections.movies.length > 0) {
        const movieSectionIds = sections.movies.join(',');
        const hasAdditionalField = sections.movies.some(id => 
          formatFields.movies[id]?.fields.some(f => f.id === 'additionalfield')
        );
        const mappings = generateMediaMappings(mappingLengths.movies, hasAdditionalField);
        
        let movieYaml = `    - Movies:
        icon: mdi-filmstrip
        id: list
        widgets:
          - type: customapi
            url: http://${localIp}:3010/api/media/recent?type=movies&section=${movieSectionIds}
            method: GET
            display: list
            mappings:
${mappings}`;

        if (showCount) {
          movieYaml += `
          - type: customapi
            url: http://${localIp}:3010/api/media/recent
            method: GET
            display: block
            mappings:
            - field:
                response:
                  libraries:
                    totals:
                      movies: total_items${valueParam}
              format: numbers
              label: Movies`;
        }
        
        yaml.push(movieYaml);
      }

      // Combined shows section
      if (sections.shows.length > 0) {
        const showSectionIds = sections.shows.join(',');
        const hasAdditionalField = sections.shows.some(id => 
          formatFields.shows[id]?.fields.some(f => f.id === 'additionalfield')
        );
        const mappings = generateMediaMappings(mappingLengths.shows, hasAdditionalField);
        
        let showYaml = `    - TV Shows:
        icon: mdi-television-classic
        id: list
        widgets:
          - type: customapi
            url: http://${localIp}:3010/api/media/recent?type=shows&section=${showSectionIds}
            method: GET
            display: list
            mappings:
${mappings}`;

        if (showCount) {
          showYaml += `
          - type: customapi
            url: http://${localIp}:3010/api/media/recent
            method: GET
            display: block
            mappings:
            - field:
                response:
                  libraries:
                    totals:
                      shows: total_items${valueParam}
              format: numbers
              label: Shows
            - field:
                response:
                  libraries:
                    totals:
                      shows: total_seasons${valueParam}
              format: numbers
              label: Seasons
            - field:
                response:
                  libraries:
                    totals:
                      shows: total_episodes${valueParam}
              format: numbers
              label: Episodes`;
        }
        
        yaml.push(showYaml);
      }
    } else {
      let sectionIndex = 0;
      // Individual section for each library section
      if (sections.movies.length > 0) {
        sections.movies.forEach(sectionId => {
          const sectionFields = formatFields.movies[sectionId]?.fields || [];
          const hasAdditionalField = sectionFields.some(f => f.id === 'additionalfield');
          const sectionName = libraryNames[sectionId] || `Movies Section ${sectionId}`;
          const mappings = generateMediaMappings(mappingLengths.movies, hasAdditionalField);

          let sectionYaml = `    - ${sectionName}:
        icon: mdi-filmstrip
        id: list
        widgets:
          - type: customapi
            url: http://${localIp}:3010/api/media/recent?type=movies&section=${sectionId}
            method: GET
            display: list
            mappings:
${mappings}`;

          if (showCount) {
            sectionYaml += `
          - type: customapi
            url: http://${localIp}:3010/api/media/recent
            method: GET
            display: block
            mappings:
            - field:
                response:
                  libraries:
                    sections:
                      ${sectionIndex}: count${valueParam}
              format: numbers
              label: Movies`;
          }

          yaml.push(sectionYaml);
          sectionIndex++;
        });
      }

      if (sections.shows.length > 0) {
        sections.shows.forEach(sectionId => {
          const sectionFields = formatFields.shows[sectionId]?.fields || [];
          const hasAdditionalField = sectionFields.some(f => f.id === 'additionalfield');
          const sectionName = libraryNames[sectionId] || `Shows Section ${sectionId}`;
          const mappings = generateMediaMappings(mappingLengths.shows, hasAdditionalField);

          let sectionYaml = `    - ${sectionName}:
        icon: mdi-television-classic
        id: list
        widgets:
          - type: customapi
            url: http://${localIp}:3010/api/media/recent?type=shows&section=${sectionId}
            method: GET
            display: list
            mappings:
${mappings}`;

          if (showCount) {
            sectionYaml += `
          - type: customapi
            url: http://${localIp}:3010/api/media/recent
            method: GET
            display: block
            mappings:
            - field:
                response:
                  libraries:
                    sections:
                      ${sectionIndex}: count${valueParam}
              format: numbers
              label: Shows
            - field:
                response:
                  libraries:
                    sections:
                      ${sectionIndex}: parent_count${valueParam}
              format: numbers
              label: Seasons
            - field:
                response:
                  libraries:
                    sections:
                      ${sectionIndex}: child_count${valueParam}
              format: numbers
              label: Episodes`;
          }

          yaml.push(sectionYaml);
          sectionIndex++;
        });
      }
    }
  }

  return yaml.length > 0 ? `- Recently Added:\n${yaml.join('\n\n')}` : '';
};

const generateMediaCountYaml = (sections, libraryNames, localIp, showIndividualCounts, useFormattedNumbers) => {
  const valueParam = useFormattedNumbers ? '_formatted' : '';
  
  if (showIndividualCounts) {
    const yaml = [];

    // Add Movies sections
    if (sections.movies.length > 0) {
      sections.movies.forEach((sectionId, index) => {
        const sectionName = libraryNames[sectionId] || `Movies Section ${sectionId}`;
        yaml.push(`    - ${sectionName}:
         widgets:
           - type: customapi
             url: http://${localIp}:3010/api/media/recent
             method: GET
             display: block
             mappings:
             - field:
                 response:
                   libraries:
                     sections:
                       ${index}: count${valueParam}
               format: numbers
               label: Movies`);
      });
    }

    // Add Shows sections
    if (sections.shows.length > 0) {
      sections.shows.forEach((sectionId, index) => {
        const sectionName = libraryNames[sectionId] || `Shows Section ${sectionId}`;
        const showIndex = sections.movies.length + index;
        yaml.push(`    - ${sectionName}:
         widgets:
           - type: customapi
             url: http://${localIp}:3010/api/media/recent
             method: GET
             display: block
             mappings:
             - field:
                 response:
                   libraries:
                     sections:
                       ${showIndex}: count${valueParam}
               format: numbers
               label: Shows
             - field:
                 response:
                   libraries:
                     sections:
                       ${showIndex}: parent_count${valueParam}
               format: numbers
               label: Seasons
             - field:
                 response:
                   libraries:
                     sections:
                       ${showIndex}: child_count${valueParam}
               format: numbers
               label: Episodes`);
      });
    }

    return `- Media Count:\n${yaml.join('\n\n')}`;
  } else {
    return `- Media Count:
    - Movies:
         widgets:
           - type: customapi
             url: http://${localIp}:3010/api/media/recent
             method: GET
             display: block
             mappings:
             - field:
                 response:
                   libraries:
                     totals:
                       movies: total_items${valueParam}
               format: numbers
               label: Movies

    - Shows:
         widgets:
           - type: customapi
             url: http://${localIp}:3010/api/media/recent
             method: GET
             display: block
             mappings:
             - field:
                 response:
                   libraries:
                     totals:
                       shows: total_items${valueParam}
               format: numbers
               label: Shows
             - field:
                 response:
                   libraries:
                     totals:
                       shows: total_seasons${valueParam}
               format: numbers
               label: Seasons
             - field:
                 response:
                   libraries:
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