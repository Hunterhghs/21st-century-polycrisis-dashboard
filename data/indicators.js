// Global stress indicators, annual values. Rounded; see `source` for each series.
window.INDICATORS = [
  {
    key: "temp", title: "Global temperature anomaly", unit: "°C", fmt: v => (v > 0 ? "+" : "") + v.toFixed(2) + " °C",
    sub: "vs. 1951–1980 average", source: "NASA GISTEMP v4",
    data: { 2000:0.39, 2001:0.53, 2002:0.62, 2003:0.61, 2004:0.53, 2005:0.67, 2006:0.62, 2007:0.64, 2008:0.52, 2009:0.63,
            2010:0.72, 2011:0.61, 2012:0.64, 2013:0.67, 2014:0.74, 2015:0.89, 2016:1.01, 2017:0.92, 2018:0.85, 2019:0.98,
            2020:1.01, 2021:0.85, 2022:0.89, 2023:1.17, 2024:1.28 }
  },
  {
    key: "co2", title: "Atmospheric CO₂", unit: "ppm", fmt: v => v.toFixed(1) + " ppm",
    sub: "Mauna Loa annual mean", source: "NOAA Global Monitoring Laboratory",
    data: { 2000:369.7, 2001:371.3, 2002:373.5, 2003:376.0, 2004:377.7, 2005:380.0, 2006:382.1, 2007:384.0, 2008:385.8, 2009:387.6,
            2010:390.1, 2011:391.9, 2012:394.1, 2013:396.7, 2014:398.8, 2015:401.0, 2016:404.4, 2017:406.8, 2018:408.7, 2019:411.7,
            2020:414.2, 2021:416.5, 2022:418.6, 2023:421.1, 2024:424.6 }
  },
  {
    key: "conflicts", title: "State-based armed conflicts", unit: "", fmt: v => Math.round(v) + " conflicts",
    sub: "active per year (approx.)", source: "Uppsala Conflict Data Program (UCDP)",
    data: { 2000:37, 2001:35, 2002:33, 2003:30, 2004:32, 2005:32, 2006:33, 2007:35, 2008:37, 2009:36,
            2010:31, 2011:37, 2012:32, 2013:34, 2014:41, 2015:52, 2016:53, 2017:50, 2018:52, 2019:54,
            2020:56, 2021:54, 2022:55, 2023:59, 2024:61 }
  },
  {
    key: "displaced", title: "Forcibly displaced people", unit: "M", fmt: v => v.toFixed(1) + " million",
    sub: "worldwide, end of year", source: "UNHCR Global Trends",
    data: { 2008:42.0, 2009:43.3, 2010:43.7, 2011:42.5, 2012:45.2, 2013:51.2, 2014:59.5, 2015:65.3, 2016:65.6, 2017:68.5,
            2018:70.8, 2019:79.5, 2020:82.4, 2021:89.3, 2022:108.4, 2023:117.3, 2024:123.2 }
  },
  {
    key: "food", title: "FAO Food Price Index", unit: "", fmt: v => v.toFixed(1),
    sub: "nominal, 2014–2016 = 100", source: "UN Food and Agriculture Organization",
    data: { 2000:53.1, 2001:54.9, 2002:53.0, 2003:57.8, 2004:65.6, 2005:67.4, 2006:72.6, 2007:94.3, 2008:117.5, 2009:91.4,
            2010:106.7, 2011:131.9, 2012:122.8, 2013:120.1, 2014:115.0, 2015:93.0, 2016:91.9, 2017:98.0, 2018:95.9, 2019:95.1,
            2020:98.1, 2021:125.7, 2022:144.5, 2023:124.7, 2024:122.0 }
  },
  {
    key: "hunger", title: "People in acute food insecurity", unit: "M", fmt: v => Math.round(v) + " million",
    sub: "IPC Phase 3+ (coverage widened over time)", source: "Global Report on Food Crises",
    data: { 2016:108, 2017:124, 2018:113, 2019:135, 2020:155, 2021:193, 2022:258, 2023:282, 2024:295 }
  }
];
