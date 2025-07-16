import { ICredentialType, INodeProperties, IHttpRequestMethods } from 'n8n-workflow';

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
            description: 'Your Presenta API token.',
        },
    ];

    test = {
        request: {
            method: 'POST' as IHttpRequestMethods,
            url: 'https://www.presenta.cc/api/render/presenta_baed0579-1df4-475f-bfb1-019b45abcac3',
            headers: {
                Authorization: '=Bearer {{$credentials.token}}',
                'Content-Type': 'application/json',
            },
            body: '{"frames": [{"frameID": "a"}]}'
        },
    };
}
