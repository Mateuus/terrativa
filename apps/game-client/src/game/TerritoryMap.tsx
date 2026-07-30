import type { TerritoryMapDefinition } from "@terrativa/board-content/geography";
import type { FeatureCollection, LineString, Point } from "geojson";
import type {
  CircleLayerSpecification,
  FillExtrusionLayerSpecification,
  LineLayerSpecification,
  SymbolLayerSpecification,
} from "maplibre-gl";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";

const openFreeMapOrigin = "https://tiles.openfreemap.org";
const localMapAssetPrefix = "/map-assets";

const routeGlow: LineLayerSpecification = {
  id: "terrativa-route-glow",
  type: "line",
  source: "terrativa-route",
  layout: {
    "line-cap": "round",
    "line-join": "round",
  },
  paint: {
    "line-color": "#07181f",
    "line-width": ["interpolate", ["linear"], ["zoom"], 8, 8, 13, 16],
    "line-opacity": 0.7,
    "line-blur": 4,
  },
};

const routeLine: LineLayerSpecification = {
  id: "terrativa-route",
  type: "line",
  source: "terrativa-route",
  layout: {
    "line-cap": "round",
    "line-join": "round",
  },
  paint: {
    "line-color": "#f2b84b",
    "line-width": ["interpolate", ["linear"], ["zoom"], 8, 3, 13, 7],
    "line-opacity": 0.96,
  },
};

const cityHalo: CircleLayerSpecification = {
  id: "terrativa-city-halo",
  type: "circle",
  source: "terrativa-cities",
  paint: {
    "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 7, 13, 12],
    "circle-color": "#07181f",
    "circle-opacity": 0.84,
    "circle-stroke-color": "#f2b84b",
    "circle-stroke-width": 2,
  },
};

const cityLabels: SymbolLayerSpecification = {
  id: "terrativa-city-labels",
  type: "symbol",
  source: "terrativa-cities",
  layout: {
    "text-field": ["get", "name"],
    "text-font": ["Noto Sans Regular"],
    "text-size": ["interpolate", ["linear"], ["zoom"], 8, 11, 13, 15],
    "text-offset": [0, 1.4],
    "text-anchor": "top",
    "text-allow-overlap": false,
  },
  paint: {
    "text-color": "#fff8e7",
    "text-halo-color": "#07181f",
    "text-halo-width": 2,
    "text-halo-blur": 1,
  },
};

const buildings3d: FillExtrusionLayerSpecification = {
  id: "terrativa-buildings-3d",
  source: "openmaptiles",
  "source-layer": "building",
  type: "fill-extrusion",
  minzoom: 14,
  filter: ["!=", ["get", "hide_3d"], true],
  paint: {
    "fill-extrusion-color": [
      "interpolate",
      ["linear"],
      ["coalesce", ["get", "render_height"], 0],
      0,
      "#d9d2bd",
      80,
      "#75c7b5",
      200,
      "#176b87",
    ],
    "fill-extrusion-height": [
      "interpolate",
      ["linear"],
      ["zoom"],
      14,
      0,
      15,
      ["coalesce", ["get", "render_height"], 8],
    ],
    "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
    "fill-extrusion-opacity": 0.82,
  },
};

interface TerritoryMapProps {
  readonly definition: TerritoryMapDefinition;
  readonly territoryName: string;
}

export function TerritoryMap({ definition, territoryName }: TerritoryMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const routeSource: FeatureCollection<LineString> = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { name: `Circuito Terrativa: ${territoryName}` },
          geometry: {
            type: "LineString",
            coordinates: definition.route,
          },
        },
      ],
    };
    const citySource: FeatureCollection<Point> = {
      type: "FeatureCollection",
      features: definition.cities.map((city, index) => ({
        type: "Feature",
        properties: {
          key: city.key,
          name: city.name,
          order: index + 1,
        },
        geometry: {
          type: "Point",
          coordinates: city.coordinates,
        },
      })),
    };

    const map = new maplibregl.Map({
      container,
      style: `${localMapAssetPrefix}/styles/liberty`,
      center: definition.center,
      zoom: definition.zoom,
      pitch: definition.pitch,
      bearing: definition.bearing,
      maxBounds: definition.bounds,
      minZoom: 8.4,
      maxZoom: 17.5,
      canvasContextAttributes: { antialias: true },
      attributionControl: false,
      cooperativeGestures: true,
      transformRequest: (url) => ({
        url: url.startsWith(openFreeMapOrigin)
          ? url.replace(openFreeMapOrigin, localMapAssetPrefix)
          : url,
      }),
    });

    map.addControl(
      new maplibregl.NavigationControl({ visualizePitch: true, showCompass: true }),
      "top-right",
    );
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "top-right");

    const collapseAttribution = () => {
      const attribution = container.querySelector<HTMLElement>(".maplibregl-ctrl-attrib");
      if (!attribution?.classList.contains("maplibregl-compact-show")) return;

      attribution.classList.remove("maplibregl-compact-show");
      attribution.removeAttribute("open");
      map.off("styledata", collapseAttribution);
      map.off("sourcedata", collapseAttribution);
    };
    map.on("styledata", collapseAttribution);
    map.on("sourcedata", collapseAttribution);
    collapseAttribution();

    map.once("style.load", () => {
      map.addSource("terrativa-route", {
        type: "geojson",
        data: routeSource,
        lineMetrics: true,
      });
      map.addSource("terrativa-cities", {
        type: "geojson",
        data: citySource,
      });
      const firstLabel = map
        .getStyle()
        .layers?.find((layer) => layer.type === "symbol" && layer.layout?.["text-field"])?.id;
      map.addLayer(buildings3d, firstLabel);
      map.addLayer(routeGlow);
      map.addLayer(routeLine);
      map.addLayer(cityHalo);
      map.addLayer(cityLabels);

      map.on("mouseenter", "terrativa-city-halo", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "terrativa-city-halo", () => {
        map.getCanvas().style.cursor = "";
      });
      map.on("click", "terrativa-city-halo", (event) => {
        const feature = event.features?.[0];
        const coordinates = (feature?.geometry as Point | undefined)?.coordinates;
        const properties = feature?.properties as
          | { name?: unknown; order?: unknown }
          | null
          | undefined;
        if (!coordinates || typeof properties?.name !== "string") return;
        const popupContent = document.createElement("div");
        const popupTitle = document.createElement("strong");
        const popupMeta = document.createElement("span");
        popupMeta.className = "territory-popup__meta";
        popupTitle.textContent = properties.name;
        popupMeta.textContent = `Parada ${String(properties.order)} do circuito`;
        popupContent.append(popupTitle, document.createElement("br"), popupMeta);
        new maplibregl.Popup({ closeButton: false, offset: 14 })
          .setLngLat([coordinates[0] as number, coordinates[1] as number])
          .setDOMContent(popupContent)
          .addTo(map);
      });

      map.resize();
    });

    map.on("error", (event) => {
      console.error("[Terrativa map] resource error", event.error);
    });

    return () => map.remove();
  }, [definition, territoryName]);

  return (
    <section
      aria-label={`Mapa real do circuito de ${territoryName}`}
      className="territory-map"
      ref={containerRef}
    />
  );
}
