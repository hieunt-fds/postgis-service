import axios from "axios";
interface api {
  host: string
  workspaceName: string
  wmsstoreName: string
  layerName?: string
  tableName?: string
  layerTitle?: string
  srs?: string
}
export async function deleteLayer({ host, workspaceName, wmsstoreName, layerName }: api) {
  await axios.delete(`${host}/layers/${layerName?.toLocaleLowerCase()}/`, {
    headers: {
      'Authorization': `Basic ${process.env.GEOSERVER_BASIC_AUTH}`
    },
    timeout: 10000
  }).then(res => {
    console.log('delete Layer global', layerName);
  }).catch(err => {
    // console.error(err)
  })
  await new Promise(r => setTimeout(r, 1000));
  return await axios.delete(`${host}/workspaces/${workspaceName}/datastores/${wmsstoreName}/featuretypes/${layerName?.toLocaleLowerCase()}/`, {
    headers: {
      'Authorization': `Basic ${process.env.GEOSERVER_BASIC_AUTH}`
    },
    timeout: 10000
  }).then(res => {
    console.log('delete Layer in store', wmsstoreName, 'layer', layerName);
    return {
      status: res.status,
      message: 'Success'
    }
  }).catch(err => {
    if (err?.response?.data) {
      console.error(err?.response?.data)
      return {
        status: err?.response?.status,
        message: err?.response?.data,
      };
    }
  })
}

export async function publishLayer({ host, workspaceName, wmsstoreName, layerName, tableName, layerTitle, srs }: api) {
  let endpoint = `${host}/workspaces/${workspaceName}/datastores/${wmsstoreName}/featuretypes/`
  let postBody = {
    "featureType": {
      "name": layerName?.toLocaleLowerCase(),
      "nativeName": tableName?.toLocaleLowerCase(),
      "title": layerTitle?.toLocaleLowerCase() || layerName?.toLocaleLowerCase(),
      "keywords": {
        "string": [
          "features",
          layerName?.toLocaleLowerCase()
        ]
      },
      "srs": srs || "EPSG:4326",
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
  // console.log(JSON.stringify(config));

  return await axios(config).then(function (response) {
    console.log('Published', layerName, layerTitle);
    return {
      status: response.status,
      message: 'Success'
    }
  }).catch(err => {
    if (err?.response?.data) {
      console.error(err?.response?.data)
      return {
        status: err?.response?.status,
        message: err?.response?.data,
      };
    }
  })
}

export async function deleteAndPublishLayer({ host, workspaceName, wmsstoreName, layerName, tableName, layerTitle, srs }: api) {
  await deleteLayer({ host, workspaceName, wmsstoreName, layerName })
  await new Promise(r => setTimeout(r, 1000));
  await publishLayer({ host, workspaceName, wmsstoreName, layerName, tableName, layerTitle, srs })
}