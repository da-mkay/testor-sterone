import { afterEach } from '@jest/globals';

export const registerPlatformMock = () => {
    const realPlatformDescriptor = Object.getOwnPropertyDescriptor(process, 'platform')!;

    afterEach(() => {
        Object.defineProperty(process, 'platform', realPlatformDescriptor);
    });

    const mockPlatform = (platform: NodeJS.Platform) => {
        Object.defineProperty(process, 'platform', {
            ...realPlatformDescriptor,
            value: platform,
        });
    };

    return mockPlatform;
};
