import { URLSearchParams } from 'url';
import type {
    IExecuteFunctions,
    INodeExecutionData,
    INodeType,
    INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionType, NodeOperationError } from 'n8n-workflow';

export class Presenta implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'Presenta',
        name: 'presenta',
        group: ['transform'],
        version: 1,
        description: 'Interact with Presenta API to render documents/images using templates',
        defaults: {
            name: 'Presenta',
        },
        inputs: [NodeConnectionType.Main],
        outputs: [NodeConnectionType.Main],
        usableAsTool: true,
        credentials: [
            {
                name: 'presentaApi',
                required: true,
                testedBy: 'PresentaApi',
                displayOptions: {
                    show: {
                        endpoint: ['render', 'cached'],
                    },
                },
            },
        ],
        properties: [
            {
                displayName: 'Endpoint',
                name: 'endpoint',
                type: 'options',
                options: [
                    { name: 'Render', value: 'render' },
                    { name: 'Cached', value: 'cached' },
                ],
                default: 'render',
                description: 'Choose the Presenta API endpoint to use',
            },
            {
                displayName: 'Template ID',
                name: 'templateId',
                type: 'string',
                default: '',
                required: true,
                description: 'The Presenta Template ID to use',
            },
            {
                displayName: 'Payload (JSON)',
                name: 'payload',
                type: 'json',
                default: '{}',
                description: 'Payload to send to Presenta. Supports both simple and structured modes.',
            },
            {
                displayName: 'Export File Format',
                name: 'f2a_exportFileFormat',
                type: 'options',
                options: [
                    { name: 'PDF', value: 'pdf' },
                    { name: 'PNG', value: 'png' },
                    { name: 'JPEG', value: 'jpeg' },
                    { name: 'WEBP', value: 'webp' },
                ],
                default: 'pdf',
                description: 'Format of the exported file',
            },
            {
                displayName: 'Filename',
                name: 'f2a_filename',
                type: 'string',
                default: 'document',
                description: 'Name of the returned document',
            },
            {
                displayName: 'Export Pure PDF',
                name: 'f2a_exportPurePDF',
                type: 'boolean',
                default: false,
                description: 'Whether to preserve vector elements in PDF',
            },
            {
                displayName: 'Cache Buster',
                name: 'f2a_cacheBuster',
                type: 'boolean',
                default: true,
                description: 'Whether to disable cache on template update (for testing)',
            },
        ],
    };

    async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
        const items = this.getInputData();
        const returnData: INodeExecutionData[] = [];

        for (let i = 0; i < items.length; i++) {
            try {
                const endpoint = this.getNodeParameter('endpoint', i) as string;
                const templateId = this.getNodeParameter('templateId', i) as string;
                let payload = this.getNodeParameter('payload', i) as object;
                const f2a_exportFileFormat = this.getNodeParameter('f2a_exportFileFormat', i) as string;
                const f2a_filename = this.getNodeParameter('f2a_filename', i) as string;
                const f2a_exportPurePDF = this.getNodeParameter('f2a_exportPurePDF', i) as boolean;
                const f2a_cacheBuster = this.getNodeParameter('f2a_cacheBuster', i) as boolean;

                // Add special properties to payload
                payload = {
                    ...payload,
                    f2a_exportFileFormat,
                    f2a_filename,
                    f2a_exportPurePDF,
                    f2a_cacheBuster,
                };

                // Get credentials
                const credentials = await this.getCredentials('presentaApi');
                if (!credentials || !credentials.token) {
                    throw new NodeOperationError(this.getNode(), 'No Presenta API token found. Please set PRESENTA_API_TOKEN in your environment.');
                }

                // Build request
                let url = `https://www.presenta.cc/api/${endpoint}/${templateId}`;
                let options: any = {
                    method: endpoint === 'render' ? 'POST' : 'GET',
                    headers: {
                        Authorization: `Bearer ${credentials.token}`,
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                    },
                };

                if (endpoint === 'render') {
                    options.body = JSON.stringify(payload);
                } else if (endpoint === 'cached') {
                    // For cached, pass payload as query params
                    const params = new URLSearchParams();
                    for (const [key, value] of Object.entries(payload)) {
                        if (typeof value !== 'undefined') {
                            params.append(key, String(value));
                        }
                    }
                    url += `?${params.toString()}`;
                }

                // Make HTTP request
                const response = await this.helpers.request({
                    url,
                    ...options,
                });

                returnData.push({ json: { response } });
            } catch (error) {
                if (this.continueOnFail()) {
                    returnData.push({ json: { error: error.message } });
                } else {
                    throw new NodeOperationError(this.getNode(), error);
                }
            }
        }

        return [returnData];
    }
}
