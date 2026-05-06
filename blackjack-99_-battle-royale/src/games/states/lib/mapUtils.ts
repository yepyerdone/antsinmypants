import * as d3 from 'd3-geo';
import * as topojson from 'topojson-client';
import us from 'us-atlas/states-10m.json';
import { StateData } from '../types';

export function getStatesData(): StateData[] {
  // @ts-ignore - us-atlas JSON structure is known
  const states = topojson.feature(us, us.objects.states).features;
  const projection = d3.geoAlbersUsa().scale(1300).translate([487.5, 305]);
  const pathGenerator = d3.geoPath().projection(projection);

  const usStateNames = new Set([
    'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 
    'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 
    'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 
    'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 
    'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 
    'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 
    'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 
    'Wisconsin', 'Wyoming'
  ]);

  return states
    .filter((d: any) => usStateNames.has(d.properties.name))
    .map((d: any) => ({
      id: d.id,
      name: d.properties.name,
      path: pathGenerator(d) || ''
    }));
}
