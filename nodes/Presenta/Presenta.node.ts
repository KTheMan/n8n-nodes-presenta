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
        icon: { light: 'file:logo.svg', dark: 'file:logo.svg' },
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
            // ...existing code...
            {
                displayName: 'Options',
                name: 'options',
                type: 'collection',
                placeholder: 'Add Option',
                default: {},
                options: [
                    {
                        displayName: 'Cache Buster',
                        name: 'f2a_cacheBuster',
                        type: 'boolean',
                        default: true,
                        description: 'Whether to disable cache on template update (for testing)',
                    },
                    {
                        displayName: 'Custom Endpoint (Full URL)',
                        name: 'customEndpoint',
                        type: 'string',
                        default: '',
                        description: 'If set, use this as the full request URL (overrides Endpoint and Template ID fields)',
                    },
                    {
                        displayName: 'Debug Output',
                        name: 'debug',
                        type: 'boolean',
                        default: false,
                        description: 'Whether to add debug output to the payload (for troubleshooting)',
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
                        displayName: 'Export Pure PDF',
                        name: 'f2a_exportPurePDF',
                        type: 'boolean',
                        default: false,
                        description: 'Whether to preserve vector elements in PDF',
                    },
                    {
                        displayName: 'Filename',
                        name: 'f2a_filename',
                        type: 'string',
                        default: 'document',
                        description: 'Name of the returned document',
                    },
                ],
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

                let payload = this.getNodeParameter('payload', i) as unknown;
                const optionsParam = this.getNodeParameter('options', i, {}) as {
                    f2a_exportFileFormat?: string;
                    f2a_filename?: string;
                    f2a_exportPurePDF?: boolean;
                    f2a_cacheBuster?: boolean;
                    debug?: boolean;
                    customEndpoint?: string; // Added customEndpoint to optionsParam
                };

                // Parse payload if it's a string
                if (typeof payload === 'string') {
                    try {
                        payload = JSON.parse(payload);
                    } catch (err) {
                        throw new NodeOperationError(this.getNode(), 'Payload is not valid JSON.');
                    }
                }
                if (typeof payload !== 'object' || payload === null) {
                    throw new NodeOperationError(this.getNode(), 'Payload must be a JSON object.');
                }

                // Add export fields from options if set (do NOT add debug to payload)
                let payloadWithExtras: any = { ...payload };
                if (optionsParam.f2a_exportFileFormat !== undefined) {
                    payloadWithExtras.f2a_exportFileFormat = optionsParam.f2a_exportFileFormat;
                }
                // Only include f2a_filename if set and not empty or default
                if (
                    optionsParam.f2a_filename !== undefined &&
                    optionsParam.f2a_filename !== '' &&
                    optionsParam.f2a_filename !== 'document'
                ) {
                    payloadWithExtras.f2a_filename = optionsParam.f2a_filename;
                }
                if (optionsParam.f2a_exportPurePDF !== undefined) {
                    payloadWithExtras.f2a_exportPurePDF = optionsParam.f2a_exportPurePDF;
                }
                if (optionsParam.f2a_cacheBuster !== undefined) {
                    payloadWithExtras.f2a_cacheBuster = optionsParam.f2a_cacheBuster;
                }

                // For backward compatibility, set these for file naming and headers
                const f2a_exportFileFormat = optionsParam.f2a_exportFileFormat || 'pdf';
                const f2a_filename = optionsParam.f2a_filename || 'document';

                // Get credentials
                const credentials = await this.getCredentials('presentaApi');
                if (!credentials || !credentials.token) {
                    throw new NodeOperationError(this.getNode(), 'No Presenta API token found. Please set PRESENTA_API_TOKEN in your environment.');
                }

                // Set MIME type based on export format
                let mimeType = 'application/pdf';
                switch (f2a_exportFileFormat) {
                    case 'png':
                        mimeType = 'image/png';
                        break;
                    case 'jpeg':
                        mimeType = 'image/jpeg';
                        break;
                    case 'webp':
                        mimeType = 'image/webp';
                        break;
                    case 'pdf':
                    default:
                        mimeType = 'application/pdf';
                        break;
                }

                // Build request

                // Support custom endpoint override
                const customEndpoint = optionsParam.customEndpoint as string | undefined;
                let url = customEndpoint && customEndpoint.trim() !== ''
                    ? customEndpoint.trim()
                    : `https://www.presenta.cc/api/${endpoint}/${templateId}`;

                let options: any = {
                    method: endpoint === 'render' ? 'POST' : 'GET',
                    headers: {
                        Authorization: `Bearer ${credentials.token}`,
                        Accept: 'application/json,text/html,application/xhtml+xml,application/xml,text/*;q=0.9, image/*;q=0.8, */*;q=0.7',
                        // 'Content-Type' will be set below only if there is a body
                    },
                };

                // Only set Content-Type and body if payloadWithExtras is not empty
                if (endpoint === 'render') {
                    if (Object.keys(payloadWithExtras).length > 0) {
                        options.body = JSON.stringify(payloadWithExtras);
                        options.headers['Content-Type'] = 'application/json';
                    }
                } else if (endpoint === 'cached') {
                    // For cached, pass payload as query params
                    const params = new URLSearchParams();
                    for (const [key, value] of Object.entries(payloadWithExtras)) {
                        if (typeof value !== 'undefined') {
                            params.append(key, String(value));
                        }
                    }
                    url += `?${params.toString()}`;
                };

                // Make HTTP request for binary response
                const requestDetails = {
                    url,
                    ...options,
                    encoding: null, // Ensure Buffer is returned
                };
                const response = await this.helpers.request(requestDetails);

                // Debug: log response type and length
                const responseType = Object.prototype.toString.call(response);
                let responseLength: number | undefined = undefined;
                if (Buffer.isBuffer(response)) {
                    responseLength = response.length;
                } else if (response instanceof ArrayBuffer) {
                    responseLength = response.byteLength;
                } else if (ArrayBuffer.isView(response)) {
                    responseLength = response.byteLength;
                } else if (typeof response === 'string') {
                    responseLength = response.length;
                }

                // Ensure response is a Buffer for binary data
                let responseBuffer: Buffer;
                if (Buffer.isBuffer(response)) {
                    responseBuffer = response;
                } else if (response instanceof ArrayBuffer) {
                    responseBuffer = Buffer.from(new Uint8Array(response));
                } else if (ArrayBuffer.isView(response)) {
                    responseBuffer = Buffer.from(response.buffer, response.byteOffset, response.byteLength);
                } else {
                    // Fallback: try to create Buffer (may be string or other type)
                    responseBuffer = Buffer.from(response);
                }

                // Prepare binary data for n8n
                const fileName = f2a_filename || `document.${f2a_exportFileFormat || 'pdf'}`;
                const binaryData = await this.helpers.prepareBinaryData(
                    responseBuffer,
                    fileName,
                    mimeType
                );

                if (optionsParam.debug === true) {
                    // Build a curl command for manual testing
                    const curlCommand = [
                        'curl',
                        '-X', endpoint === 'render' ? 'POST' : 'GET',
                        `'${url}'`,
                        '-H', `'Authorization: Bearer ${credentials.token}'`,
                        '-H', `'Content-Type: application/json'`,
                        endpoint === 'render' ? `--data-raw '${JSON.stringify(payloadWithExtras)}'` : '',
                        '-o', `'output.pdf'`
                    ].filter(Boolean).join(' ');
                    returnData.push({
                        binary: {
                            data: binaryData,
                        },
                        json: {
                            debug: {
                                payload: payloadWithExtras,
                                request: requestDetails,
                                responseType,
                                responseLength,
                                response: responseBuffer.toString('base64'),
                                responseFirst100Base64: responseBuffer.slice(0, 100).toString('base64'),
                                responseFirst100Utf8: responseBuffer.slice(0, 100).toString('utf8'),
                                curl: curlCommand,
                            },
                        },
                    });
                } else {
                    returnData.push({
                        binary: {
                            data: binaryData,
                        },
                        json: {},
                    });
                }
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
