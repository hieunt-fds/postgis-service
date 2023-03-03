import axios from "axios";
interface api {
  host: string,
  workspaceName: string,
  wmsstoreName: string,
  layerName?: string
  tableName?: string
  layerTitle?: string
}
async function deleteLayer({ host, workspaceName, wmsstoreName, layerName }: api) {
  await axios.delete(`${host}/layers/${layerName}/`, {
    headers: {
      'Authorization': `Basic ${process.env.GEOSERVER_BASIC_AUTH}`
    },
    timeout: 10000
  }).then(res => {
    console.log('delete Layer global', layerName);
  }).catch()
  await new Promise(r => setTimeout(r, 1000));
  await axios.delete(`${host}/workspaces/${workspaceName}/datastores/${wmsstoreName}/featuretypes/${layerName}/`, {
    headers: {
      'Authorization': `Basic ${process.env.GEOSERVER_BASIC_AUTH}`
    },
    timeout: 10000
  }).then(res => {
    console.log('delete Layer in store', wmsstoreName, 'layer', layerName);
  }).catch()
}

async function publishLayer({ host, workspaceName, wmsstoreName, layerName, tableName, layerTitle }: api) {
  let endpoint = `${host}/workspaces/${workspaceName}/datastores/${wmsstoreName}/featuretypes/`
  let postBody = {
    "featureType": {
      "name": layerName,
      "nativeName": tableName,
      "title": layerTitle || layerName,
      "keywords": {
        "string": [
          "features",
          layerName
        ]
      },
      "nativeCRS": "GEOGCS[\"WGS 84\", \n  DATUM[\"World Geodetic System 1984\", \n    SPHEROID[\"WGS 84\", 6378137.0, 298.257223563, AUTHORITY[\"EPSG\",\"7030\"]], \n    AUTHORITY[\"EPSG\",\"6326\"]], \n  PRIMEM[\"Greenwich\", 0.0, AUTHORITY[\"EPSG\",\"8901\"]], \n  UNIT[\"degree\", 0.017453292519943295], \n  AXIS[\"Geodetic longitude\", EAST], \n  AXIS[\"Geodetic latitude\", NORTH], \n  AUTHORITY[\"EPSG\",\"4326\"]]",
      "srs": "EPSG:4326",
      "projectionPolicy": "FORCE_DECLARED",
      "enabled": true
    }
  }
  let config = {
    method: 'post',
    url: endpoint,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${process.env.GEOSERVER_BASIC_AUTH}`
    },
    timeout: 10000,
    data: postBody
  };

  await axios(config).then(function (response) {
    console.log('Published', layerName);

  }).catch()
}

export async function deleteAndPublishLayer({ host, workspaceName, wmsstoreName, layerName, tableName, layerTitle }: api) {
  await deleteLayer({ host, workspaceName, wmsstoreName, layerName })
  await new Promise(r => setTimeout(r, 1000));
  await publishLayer({ host, workspaceName, wmsstoreName, layerName, tableName, layerTitle })
}