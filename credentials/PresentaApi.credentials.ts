import { ICredentialType, INodeProperties } from 'n8n-workflow';

export class PresentaApi implements ICredentialType {
    name = 'presentaApi';
    displayName = 'Presenta API';
    documentationUrl = 'https://docs.presenta.cc/api.html';
    properties: INodeProperties[] = [
        {
            displayName: 'API Token',
            name: 'token',
            type: 'string',
            default: '',
            required: true,
            typeOptions: {
                password: true,
            },
            description: 'Your Presenta API token. Recommended: use environment variable.',
            env: 'PRESENTA_API_TOKEN',
        },
    ];
}
