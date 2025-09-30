import * as React from "react";
import "./hubspot.styl";

export const HubspotWidget: React.FC<{ email: string; token: string; portalId: string; }> = (props) => {

    React.useEffect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).hsConversationsSettings = {
            enableWidgetCookieBanner: false,
            loadImmediately: true,
            // Hides the upload attachment button if true
            disableAttachment: false, 
            identificationEmail: props.email,
            identificationToken: props.token
        };

        // Create the script element
        const script = document.createElement("script");
        script.type = "text/javascript";
        script.id = "hs-script-loader";
        script.async = true;
        script.defer = true;
        script.src = `//js-eu1.hs-scripts.com/${props.portalId}.js`;

        // Append the script to the document
        document.body.appendChild(script);

        // Cleanup function to remove the script when component unmounts
        return () => {
            const existingScript = document.getElementById("hs-script-loader");
            if (existingScript) {
                document.body.removeChild(existingScript);
            }
        };
    }, [props.email, props.token, props.portalId]);

    return null;
}
