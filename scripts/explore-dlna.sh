#!/bin/bash

# Check if server and port are provided
if [ -z "$1" ] || [ -z "$2" ]; then
    echo "Usage: $0 <server> <port> [media_id]"
    echo "Example: $0 192.168.68.51 8200"
    echo "Example: $0 192.168.68.51 8200 573"
    exit 1
fi

SERVER=$1
PORT=$2
MEDIA_ID=$3

# Function to get a specific media item
get_media_item() {
    local media_id=$1
    echo "Trying to get media item $media_id..."
    echo "URL: http://$SERVER:$PORT/MediaItems/$media_id.mkv"
    
    # Try to get the file info with verbose output
    echo "Trying HEAD request..."
    curl -v -I "http://$SERVER:$PORT/MediaItems/$media_id.mkv"
    
    echo -e "\nTrying GET request..."
    curl -v "http://$SERVER:$PORT/MediaItems/$media_id.mkv"
}

# Function to list all media items
list_media_items() {
    echo "Listing all media items..."
    curl -s "http://$SERVER:$PORT/MediaItems/" | grep -o "<item>.*</item>" | while read -r item; do
        if [ ! -z "$item" ]; then
            # Extract title
            title=$(echo "$item" | grep -o "<title>.*</title>" | sed 's/<title>\(.*\)<\/title>/\1/')
            # Extract ID
            id=$(echo "$item" | grep -o "id=\"[^\"]*\"" | sed 's/id=\"\([^\"]*\)\"/\1/')
            echo "ID: $id"
            echo "Title: $title"
            echo "URL: http://$SERVER:$PORT/MediaItems/$id.mkv"
            echo
        fi
    done
}

# Function to browse a container
browse_container() {
    local object_id=$1
    local indent=$2
    
    # Browse the container using UPnP SOAP
    response=$(curl -s -X POST "http://$SERVER:$PORT/ContentDirectory/control" \
        -H "Content-Type: text/xml; charset=utf-8" \
        -H "SOAPAction: \"urn:schemas-upnp-org:service:ContentDirectory:1#Browse\"" \
        -d "<?xml version=\"1.0\" encoding=\"utf-8\"?>
            <s:Envelope xmlns:s=\"http://schemas.xmlsoap.org/soap/envelope/\" s:encodingStyle=\"http://schemas.xmlsoap.org/soap/encoding/\">
                <s:Body>
                    <u:Browse xmlns:u=\"urn:schemas-upnp-org:service:ContentDirectory:1\">
                        <ObjectID>$object_id</ObjectID>
                        <BrowseFlag>BrowseDirectChildren</BrowseFlag>
                        <Filter>*</Filter>
                        <StartingIndex>0</StartingIndex>
                        <RequestedCount>0</RequestedCount>
                        <SortCriteria></SortCriteria>
                    </u:Browse>
                </s:Body>
            </s:Envelope>")

    # Flatten XML to a single line
    flat_response=$(echo "$response" | tr -d '\n')

    # Extract containers (folders)
    containers=$(echo "$flat_response" | grep -o "<container[^>]*>.*?</container>")
    echo "$containers" | while read -r container; do
        if [ ! -z "$container" ]; then
            # Extract title
            title=$(echo "$container" | grep -o "<dc:title>.*</dc:title>" | sed 's/<dc:title>\(.*\)<\/dc:title>/\1/')
            # Extract object ID
            cid=$(echo "$container" | grep -o "id=\"[^\"]*\"" | sed 's/id=\"\([^\"]*\)\"/\1/')
            echo "${indent}[FOLDER] $title"
            echo "${indent}Object ID: $cid"
            echo
        fi
    done

    # Extract items (files)
    items=$(echo "$flat_response" | grep -o "<item[^>]*>.*?</item>")
    echo "$items" | while read -r item; do
        if [ ! -z "$item" ]; then
            # Extract title
            title=$(echo "$item" | grep -o "<dc:title>.*</dc:title>" | sed 's/<dc:title>\(.*\)<\/dc:title>/\1/')
            # Extract object ID
            iid=$(echo "$item" | grep -o "id=\"[^\"]*\"" | sed 's/id=\"\([^\"]*\)\"/\1/')
            # Extract resource URL
            res=$(echo "$item" | grep -o "<res>.*</res>" | sed 's/<res>\(.*\)<\/res>/\1/')
            echo "${indent}[FILE] $title"
            echo "${indent}Object ID: $iid"
            if [ ! -z "$res" ]; then
                echo "${indent}Resource: $res"
            fi
            echo
        fi
    done
}

echo "Exploring DLNA server at $SERVER:$PORT"

if [ ! -z "$MEDIA_ID" ]; then
    # If a media ID is provided, try to get that specific item
    get_media_item "$MEDIA_ID"
else
    # Otherwise, try to list all media items
    list_media_items
fi 