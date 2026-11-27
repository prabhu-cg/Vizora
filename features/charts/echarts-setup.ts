import { BarChart, BoxplotChart, CustomChart, FunnelChart, HeatmapChart, LineChart, PieChart, ScatterChart, TreemapChart } from "echarts/charts";
import { AriaComponent, GraphicComponent, GridComponent, LegendComponent, TitleComponent, TooltipComponent, VisualMapComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { LegacyGridContainLabel } from "echarts/features";
import { CanvasRenderer, SVGRenderer } from "echarts/renderers";

/** One registration for the whole app, so the on-screen and exported charts support exactly the same chart types. */
echarts.use([
  BarChart, LineChart, PieChart, ScatterChart, HeatmapChart, TreemapChart, BoxplotChart, FunnelChart, CustomChart,
  GridComponent, TooltipComponent, LegendComponent, TitleComponent, VisualMapComponent, AriaComponent, GraphicComponent,
  LegacyGridContainLabel, CanvasRenderer, SVGRenderer,
]);

export { echarts };
