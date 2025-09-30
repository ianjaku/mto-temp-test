import * as QRCodeAPI from "qrcode";
import * as React from "react";
import { QrCodeAndShareLinks } from "../../../src/elements/qrCodeAndShareLinks/QrCodeAndShareLinks";
import { create } from "react-test-renderer";
import { shallow } from "enzyme";

const link = "http://manual.to/";

const createQRCode = () => (
    <QrCodeAndShareLinks link={link} />
);

function asyncGenerateQRCode(url: string): Promise<unknown> {

    const options = {
        margin: 0,
    };

    return new Promise((resolve, reject) => {
        // eslint-disable-next-line @typescript-eslint/ban-types
        QRCodeAPI.toDataURL(url, options, (error: object, dataUrl: string) => {
            if (error) {
                reject(error);
            } else {
                const QRObject = {
                    dataImage: dataUrl,
                    link: url,
                };
                resolve(QRObject);
            }
        });
    });
}


describe("QRCode", () => {

    test("Base tabs (snapshot)", () => {
        return asyncGenerateQRCode(link).then(() => {
            const QRComponent = create(createQRCode());
            const serialized = QRComponent.toJSON();
            expect(serialized).toMatchSnapshot();
        });
    });

    test("Check QR Code Async loaded", () => {
        const QRCodeMount = shallow(createQRCode(), { lifecycleExperimental: true });
        return asyncGenerateQRCode(link).then((data) => {
            expect(QRCodeMount.state("object")).toEqual(data);
        });
    });
});
